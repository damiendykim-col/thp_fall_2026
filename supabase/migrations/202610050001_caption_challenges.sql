-- Stage 1. Run after the profile cutover. No changes to existing profile data.
begin;
create table public.challenges (
 id uuid primary key default gen_random_uuid(),
 creator_id uuid not null references public.profiles(id) on delete cascade,
 image_path text,
 template_id uuid references public.images(id),
 template_url text,
 situation text not null check (char_length(situation) between 1 and 500),
 status text not null default 'draft' check(status in ('draft','generating','failed','ready','published')),
 created_at timestamptz not null default now(),
 published_at timestamptz,
 closes_at timestamptz,
 check ((image_path is not null)::int + (template_id is not null)::int = 1),
 check (image_path is null or split_part(image_path,'/',1) = creator_id::text)
);
create index challenges_feed on public.challenges(published_at desc) where status='published';
create index challenges_owner on public.challenges(creator_id,created_at desc);
create table public.challenge_captions (
 id uuid primary key default gen_random_uuid(),
 challenge_id uuid not null references public.challenges(id) on delete cascade,
 body text not null check(char_length(btrim(body)) between 1 and 280),
 origin text not null check(origin in ('human','ai')),
 unique(challenge_id,origin), unique(challenge_id,id)
);
create table public.challenge_generations (
 id uuid primary key default gen_random_uuid(),
 challenge_id uuid not null references public.challenges(id) on delete cascade,
 owner_id uuid not null references public.profiles(id) on delete cascade,
 provider text not null, model text not null, prompt jsonb not null,
 status text not null default 'running' check(status in ('running','succeeded','failed')),
 created_at timestamptz not null default now(), finished_at timestamptz
);
create index challenge_generation_quota on public.challenge_generations(owner_id,created_at);
create table public.challenge_votes (
 user_id uuid not null references public.profiles(id) on delete cascade,
 challenge_id uuid not null references public.challenges(id) on delete cascade,
 caption_id uuid not null,
 primary key(user_id,challenge_id),
 foreign key(challenge_id,caption_id) references public.challenge_captions(challenge_id,id)
);
create index challenge_vote_totals on public.challenge_votes(challenge_id,caption_id);
alter table public.challenges enable row level security;
alter table public.challenge_captions enable row level security;
alter table public.challenge_generations enable row level security;
alter table public.challenge_votes enable row level security;
revoke all on public.challenges, public.challenge_captions, public.challenge_generations, public.challenge_votes from anon, authenticated;
grant select on public.challenges,public.challenge_generations,public.challenge_votes to authenticated;
grant all on public.challenges,public.challenge_captions,public.challenge_generations,public.challenge_votes to service_role;
create policy "Read published or own challenges" on public.challenges for select to authenticated using(status='published' or creator_id=(select auth.uid()));
create policy "Read own generation history" on public.challenge_generations for select to authenticated using(owner_id=(select auth.uid()));
create policy "Read own votes" on public.challenge_votes for select to authenticated using(user_id=(select auth.uid()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('challenge-images','challenge-images',false,3145728,array['image/jpeg']) on conflict(id) do nothing;
-- Only the server uploads normalized files. There are intentionally no client write policies.
create policy "Read permitted challenge images" on storage.objects for select to authenticated using(
 bucket_id='challenge-images' and ((storage.foldername(name))[1]=(select auth.uid())::text or exists(
 select 1 from public.challenges c where c.image_path=name and c.status='published')));

-- Service-only creation: uploads and all image paths have been validated by the server.
create function public.create_caption_challenge(p_owner uuid,p_image text,p_template uuid,p_situation text,p_caption text)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; template text;
begin
 perform 1 from public.profiles where id=p_owner for update;
 if not found then raise exception 'Profile required'; end if;
 if (select count(*) from public.challenges where creator_id=p_owner and created_at>now()-interval '1 day')>=10 then raise exception 'Daily challenge limit reached'; end if;
 if p_template is not null then
 select image_url into template from public.images where id=p_template;
 if not found then raise exception 'Template unavailable'; end if;
 elsif p_image is null or split_part(p_image,'/',1)<>p_owner::text or not exists(select 1 from storage.objects where bucket_id='challenge-images' and name=p_image) then
 raise exception 'Image unavailable';
 end if;
 insert into public.challenges(creator_id,image_path,template_id,template_url,situation) values(p_owner,p_image,p_template,template,btrim(p_situation)) returning id into result;
 insert into public.challenge_captions(challenge_id,body,origin) values(result,btrim(p_caption),'human');
 return result;
end $$;

create function public.claim_caption_generation(p_owner uuid,p_challenge uuid,p_provider text,p_model text,p_prompt jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.challenges; result uuid;
begin
 perform 1 from public.profiles where id=p_owner for update;
 select * into c from public.challenges where id=p_challenge and creator_id=p_owner for update;
 if not found then raise exception 'Challenge unavailable'; end if;
 -- Recover an interrupted request after its server timeout. Old completions cannot win.
 update public.challenge_generations set status='failed',finished_at=clock_timestamp() where challenge_id=c.id and status='running' and created_at<clock_timestamp()-interval '2 minutes';
 if c.status not in ('draft','failed','generating') or exists(select 1 from public.challenge_generations where challenge_id=c.id and status='running') then raise exception 'Generation already started or complete'; end if;
 if (select count(*) from public.challenge_generations where challenge_id=c.id)>=3 or (select count(*) from public.challenge_generations where owner_id=p_owner and created_at>now()-interval '1 day')>=10 then raise exception 'Generation limit reached'; end if;
 insert into public.challenge_generations(challenge_id,owner_id,provider,model,prompt) values(c.id,p_owner,p_provider,p_model,p_prompt) returning id into result;
 update public.challenges set status='generating' where id=c.id;
 return result;
end $$;
create function public.finish_caption_generation(p_request uuid,p_caption text)
returns void language plpgsql security definer set search_path='' as $$
declare g public.challenge_generations;
begin
 -- Same lock order as claim: challenge then generation.
 perform 1 from public.challenges where id=(select challenge_id from public.challenge_generations where id=p_request) for update;
 select * into g from public.challenge_generations where id=p_request for update;
 if not found or g.status<>'running' then return; end if;
 if p_caption is not null then
 insert into public.challenge_captions(challenge_id,body,origin) values(g.challenge_id,btrim(p_caption),'ai');
 end if;
 update public.challenge_generations set status=case when p_caption is null then 'failed' else 'succeeded' end,finished_at=clock_timestamp() where id=g.id;
 update public.challenges set status=case when p_caption is null then 'failed' else 'ready' end where id=g.challenge_id;
end $$;
create function public.publish_caption_challenge(p_challenge uuid)
returns void language plpgsql security definer set search_path='' as $$
declare c public.challenges;
begin
 select * into c from public.challenges where id=p_challenge and creator_id=(select auth.uid()) for update;
 if not found then raise exception 'Challenge unavailable'; end if;
 if c.status='published' then return; end if;
 if c.status<>'ready' or (select count(*) from public.challenge_captions where challenge_id=c.id)<>2 then raise exception 'Generate both captions before publishing'; end if;
 update public.challenges set status='published',published_at=clock_timestamp(),closes_at=clock_timestamp()+interval '24 hours' where id=c.id;
end $$;
create function public.vote_caption_challenge(p_challenge uuid,p_caption uuid)
returns void language plpgsql security definer set search_path='' as $$
declare c public.challenges; viewer uuid:=(select auth.uid());
begin
 if viewer is null then raise exception 'Sign in required'; end if;
 select * into c from public.challenges where id=p_challenge for update;
 if not found or c.status<>'published' then raise exception 'Challenge unavailable'; end if;
 if c.closes_at<=clock_timestamp() then raise exception 'Voting has closed'; end if;
 if c.creator_id=viewer then raise exception 'Creators cannot vote on their own challenge'; end if;
 if p_caption is null then delete from public.challenge_votes where user_id=viewer and challenge_id=c.id;
 else
 if not exists(select 1 from public.challenge_captions where id=p_caption and challenge_id=c.id) then raise exception 'Caption unavailable'; end if;
 insert into public.challenge_votes(user_id,challenge_id,caption_id) values(viewer,c.id,p_caption) on conflict(user_id,challenge_id) do update set caption_id=excluded.caption_id;
 end if;
end $$;
-- This is the ONLY caption read surface. No origin, timestamps or totals before closing.
create function public.read_caption_challenge(p_challenge uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.challenges; viewer uuid:=(select auth.uid()); closed boolean;
begin
 if viewer is null then return null; end if;
 select * into c from public.challenges where id=p_challenge and (status='published' or creator_id=viewer);
 if not found then return null; end if;
 closed:=c.status='published' and c.closes_at<=clock_timestamp();
 return jsonb_build_object('id',c.id,'own',c.creator_id=viewer,'status',c.status,'situation',c.situation,'image_path',c.image_path,'template_url',c.template_url,'closes_at',c.closes_at,'closed',closed,
 'vote',(select caption_id from public.challenge_votes where challenge_id=c.id and user_id=viewer),
 'captions',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'body',x.body,'origin',case when closed or (c.creator_id=viewer and c.status<>'published') then x.origin end,'votes',case when closed then (select count(*) from public.challenge_votes v where v.caption_id=x.id) end) order by md5(x.id::text||viewer::text)) from public.challenge_captions x where x.challenge_id=c.id),'[]'::jsonb));
end $$;
revoke all on function public.create_caption_challenge(uuid,text,uuid,text,text),public.claim_caption_generation(uuid,uuid,text,text,jsonb),public.finish_caption_generation(uuid,text) from public,anon,authenticated;
grant execute on function public.create_caption_challenge(uuid,text,uuid,text,text),public.claim_caption_generation(uuid,uuid,text,text,jsonb),public.finish_caption_generation(uuid,text) to service_role;
revoke all on function public.publish_caption_challenge(uuid),public.vote_caption_challenge(uuid,uuid),public.read_caption_challenge(uuid) from public,anon;
grant execute on function public.publish_caption_challenge(uuid),public.vote_caption_challenge(uuid,uuid),public.read_caption_challenge(uuid) to authenticated;
commit;
