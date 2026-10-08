-- Run after image descriptions. Existing published challenges are not auto-certified.
begin;
create table public.moderators (
 user_id uuid primary key references public.profiles(id) on delete cascade
);
alter table public.moderators enable row level security;
revoke all on public.moderators from public,anon,authenticated;
grant all on public.moderators to service_role;
create function public.is_moderator() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.moderators where user_id=(select auth.uid()));
$$;
revoke all on function public.is_moderator() from public,anon;
grant execute on function public.is_moderator() to authenticated;

create table public.moderation_checks (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 phase text not null check(phase in ('image','human','ai')),
 input_hash text not null,
 policy_version text not null,
 provider text not null, model text not null,
 status text not null check(status in ('running','approved','blocked','error')),
 category text not null default 'none' check(category in ('none','hate','harassment','violence','sexual','self_harm','privacy','provider_block')),
 attempts integer not null default 1,
 started_at timestamptz not null default clock_timestamp(),
 created_at timestamptz not null default now(),
 unique(owner_id,phase,input_hash,policy_version)
);
alter table public.moderation_checks enable row level security;
revoke all on public.moderation_checks from public,anon,authenticated;
grant select on public.moderation_checks to authenticated;
grant all on public.moderation_checks to service_role;
create policy "Read own safety results" on public.moderation_checks for select to authenticated using(owner_id=(select auth.uid()));
create index moderation_owner_quota on public.moderation_checks(owner_id,created_at);

create function public.claim_moderation(p_owner uuid,p_phase text,p_hash text,p_policy text,p_provider text,p_model text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare check_row public.moderation_checks;
begin
 perform 1 from public.profiles where id=p_owner for update;
 if not found then raise exception 'Profile required'; end if;
 select * into check_row from public.moderation_checks where owner_id=p_owner and phase=p_phase and input_hash=p_hash and policy_version=p_policy for update;
 if found and (check_row.status in ('approved','blocked') or (check_row.status='running' and check_row.started_at>clock_timestamp()-interval '2 minutes')) then
  return to_jsonb(check_row)||jsonb_build_object('claimed',false);
 end if;
 if coalesce(check_row.attempts,0)>=3 or (select coalesce(sum(attempts),0) from public.moderation_checks where owner_id=p_owner and started_at>now()-interval '1 day')>=40 then raise exception 'Safety check limit reached'; end if;
 if check_row.id is null then
  insert into public.moderation_checks(owner_id,phase,input_hash,policy_version,provider,model,status)
   values(p_owner,p_phase,p_hash,p_policy,p_provider,p_model,'running') returning * into check_row;
 else
  update public.moderation_checks set status='running',started_at=clock_timestamp(),attempts=attempts+1,
   provider=p_provider,model=p_model where id=check_row.id returning * into check_row;
 end if;
 return to_jsonb(check_row)||jsonb_build_object('claimed',true);
end $$;
revoke all on function public.claim_moderation(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.claim_moderation(uuid,text,text,text,text,text) to service_role;

create table public.challenge_template_reviews (
 template_id uuid primary key references public.images(id) on delete cascade,
 image_url text not null,
 policy_version text not null,
 reviewed_by uuid references public.profiles(id) on delete set null,
 reviewed_at timestamptz not null default now()
);
alter table public.challenge_template_reviews enable row level security;
revoke all on public.challenge_template_reviews from public,anon,authenticated;
grant all on public.challenge_template_reviews to service_role;

alter table public.challenge_images add column moderation_id uuid references public.moderation_checks(id);
alter table public.challenges add column asset_moderation_id uuid references public.moderation_checks(id);
alter table public.challenges add column human_moderation_id uuid references public.moderation_checks(id);
alter table public.challenges add column ai_moderation_id uuid references public.moderation_checks(id);
alter table public.challenges add column hidden_at timestamptz;
alter table public.challenges add column hidden_by uuid references public.profiles(id) on delete set null;

create function public.safety_approved(p_check uuid,p_owner uuid,p_phase text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.moderation_checks where id=p_check and owner_id=p_owner
  and phase=p_phase and status='approved' and policy_version='moderation-v1');
$$;
revoke all on function public.safety_approved(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.safety_approved(uuid,uuid,text) to service_role;

create or replace function public.publish_caption_challenge(p_challenge uuid)
returns void language plpgsql security definer set search_path='' as $$
declare c public.challenges;
begin
 select * into c from public.challenges where id=p_challenge and creator_id=(select auth.uid()) for update;
 if not found or c.hidden_at is not null then raise exception 'Challenge unavailable'; end if;
 if not public.safety_approved(c.human_moderation_id,c.creator_id,'human')
  or not public.safety_approved(c.ai_moderation_id,c.creator_id,'ai')
  or (c.image_path is not null and not public.safety_approved(c.asset_moderation_id,c.creator_id,'image'))
  or (c.template_id is not null and not exists(select 1 from public.challenge_template_reviews where template_id=c.template_id and image_url=c.template_url and policy_version='moderation-v1'))
 then raise exception 'Safety approval required'; end if;
 if c.status='published' then return; end if;
 if c.status<>'ready' or (select count(*) from public.challenge_captions where challenge_id=c.id)<>2 then raise exception 'Generate both captions before publishing'; end if;
 update public.challenges set status='published',published_at=clock_timestamp(),closes_at=clock_timestamp()+interval '24 hours' where id=c.id;
end $$;

drop policy "Read published or own challenges" on public.challenges;
create policy "Read published or own challenges" on public.challenges for select to authenticated
 using(creator_id=(select auth.uid()) or (status='published' and hidden_at is null));
drop policy "Read permitted challenge images" on storage.objects;
create policy "Read permitted challenge images" on storage.objects for select to authenticated using(
 bucket_id='challenge-images' and ((storage.foldername(name))[1]=(select auth.uid())::text or exists(
 select 1 from public.challenges c where c.image_path=name and c.status='published' and c.hidden_at is null)));

create table public.challenge_reports (
 id uuid primary key default gen_random_uuid(),
 challenge_id uuid not null references public.challenges(id) on delete cascade,
 reporter_id uuid not null references public.profiles(id) on delete cascade,
 reason text not null check(reason in ('hate','harassment','violence','sexual','self_harm','privacy','other')),
 created_at timestamptz not null default now(),
 resolved_at timestamptz,
 unique(challenge_id,reporter_id)
);
alter table public.challenge_reports enable row level security;
revoke all on public.challenge_reports from public,anon,authenticated;
grant select on public.challenge_reports to authenticated;
grant all on public.challenge_reports to service_role;
create policy "Read own reports" on public.challenge_reports for select to authenticated using(reporter_id=(select auth.uid()));
create index reports_quota on public.challenge_reports(reporter_id,created_at);

create function public.report_challenge(p_challenge uuid,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare viewer uuid:=(select auth.uid());
begin
 perform 1 from public.profiles where id=viewer for update;
 if not found then raise exception 'Sign in required'; end if;
 if not exists(select 1 from public.challenges where id=p_challenge and status='published' and hidden_at is null) then raise exception 'Challenge unavailable'; end if;
 if exists(select 1 from public.challenge_reports where challenge_id=p_challenge and reporter_id=viewer) then return; end if;
 if (select count(*) from public.challenge_reports where reporter_id=viewer and created_at>now()-interval '1 day')>=10 then raise exception 'Report limit reached'; end if;
 insert into public.challenge_reports(challenge_id,reporter_id,reason) values(p_challenge,viewer,p_reason);
end $$;
create function public.hide_challenge(p_challenge uuid) returns void
language plpgsql security definer set search_path='' as $$
declare c public.challenges;
begin
 if (select auth.uid()) is null then raise exception 'Sign in required'; end if;
 select * into c from public.challenges where id=p_challenge for update;
 if not found or (c.creator_id<>(select auth.uid()) and not public.is_moderator()) then raise exception 'Not authorized'; end if;
 update public.challenges set hidden_at=coalesce(hidden_at,clock_timestamp()),hidden_by=(select auth.uid()) where id=c.id;
 update public.challenge_reports set resolved_at=coalesce(resolved_at,clock_timestamp()) where challenge_id=c.id;
end $$;
create function public.dismiss_challenge_report(p_report uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_moderator() then raise exception 'Not authorized'; end if;
 update public.challenge_reports set resolved_at=clock_timestamp() where id=p_report;
end $$;
create function public.list_challenge_reports() returns table(id uuid,challenge_id uuid,reason text,created_at timestamptz,situation text)
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_moderator() then raise exception 'Not authorized'; end if;
 return query select r.id,r.challenge_id,r.reason,r.created_at,c.situation from public.challenge_reports r join public.challenges c on c.id=r.challenge_id
 where r.resolved_at is null order by r.created_at limit 100;
end $$;
create function public.list_unreviewed_templates() returns table(id uuid,image_url text,description text)
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_moderator() then raise exception 'Not authorized'; end if;
 return query select i.id,i.image_url,i.description from public.images i where not exists(select 1 from public.challenge_template_reviews r where r.template_id=i.id and r.image_url=i.image_url and r.policy_version='moderation-v1') order by i.created_at limit 50;
end $$;
create function public.approve_challenge_template(p_template uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_moderator() then raise exception 'Not authorized'; end if;
 insert into public.challenge_template_reviews(template_id,image_url,policy_version,reviewed_by) select id,image_url,'moderation-v1',(select auth.uid()) from public.images where id=p_template
 on conflict(template_id) do update set image_url=excluded.image_url,policy_version=excluded.policy_version,reviewed_by=excluded.reviewed_by,reviewed_at=clock_timestamp();
end $$;
revoke all on function public.report_challenge(uuid,text),public.hide_challenge(uuid),public.dismiss_challenge_report(uuid),public.list_challenge_reports(),public.list_unreviewed_templates(),public.approve_challenge_template(uuid) from public,anon;
grant execute on function public.report_challenge(uuid,text),public.hide_challenge(uuid),public.dismiss_challenge_report(uuid),public.list_challenge_reports(),public.list_unreviewed_templates(),public.approve_challenge_template(uuid) to authenticated;
create or replace function public.vote_caption_challenge(p_challenge uuid,p_caption uuid)
returns void language plpgsql security definer set search_path='' as $$
declare c public.challenges; viewer uuid:=(select auth.uid());
begin
 if viewer is null then raise exception 'Sign in required'; end if;
 select * into c from public.challenges where id=p_challenge for update;
 if not found or c.status<>'published' or c.hidden_at is not null then raise exception 'Challenge unavailable'; end if;
 if c.closes_at<=clock_timestamp() then raise exception 'Voting has closed'; end if;
 if c.creator_id=viewer then raise exception 'Creators cannot vote on their own challenge'; end if;
 if p_caption is null then delete from public.challenge_votes where user_id=viewer and challenge_id=c.id;
 else
 if not exists(select 1 from public.challenge_captions where id=p_caption and challenge_id=c.id) then raise exception 'Caption unavailable'; end if;
 insert into public.challenge_votes(user_id,challenge_id,caption_id) values(viewer,c.id,p_caption) on conflict(user_id,challenge_id) do update set caption_id=excluded.caption_id;
 end if;
end $$;

create or replace function public.read_caption_challenge(p_challenge uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.challenges; viewer uuid:=(select auth.uid()); closed boolean;
begin
 if viewer is null then return null; end if;
 select * into c from public.challenges where id=p_challenge and ((status='published' and hidden_at is null) or creator_id=viewer);
 if not found then return null; end if;
 closed:=c.status='published' and c.closes_at<=clock_timestamp();
 return jsonb_build_object('id',c.id,'own',c.creator_id=viewer,'status',c.status,'situation',c.situation,
 'hidden_at',c.hidden_at,'image_description',c.image_description,'joke_context',c.joke_context,
 'image_path',c.image_path,'template_url',c.template_url,'closes_at',c.closes_at,'closed',closed,
 'vote',(select caption_id from public.challenge_votes where challenge_id=c.id and user_id=viewer),
 'captions',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'body',x.body,'origin',case when closed or (c.creator_id=viewer and c.status<>'published') then x.origin end,'votes',case when closed then (select count(*) from public.challenge_votes v where v.caption_id=x.id) end) order by md5(x.id::text||viewer::text)) from public.challenge_captions x where x.challenge_id=c.id),'[]'::jsonb));
end $$;

create or replace function public.claim_caption_generation(p_owner uuid,p_challenge uuid,p_provider text,p_model text,p_prompt jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.challenges; result uuid;
begin
 perform 1 from public.profiles where id=p_owner for update;
 select * into c from public.challenges where id=p_challenge and creator_id=p_owner for update;
 if not found or c.hidden_at is not null then raise exception 'Challenge unavailable'; end if;
 -- Recover an interrupted request after its server timeout. Old completions cannot win.
 update public.challenge_generations set status='failed',finished_at=clock_timestamp() where challenge_id=c.id and status='running' and created_at<clock_timestamp()-interval '2 minutes';
 if c.status not in ('draft','failed','generating') or exists(select 1 from public.challenge_generations where challenge_id=c.id and status='running') then raise exception 'Generation already started or complete'; end if;
 if (select count(*) from public.challenge_generations where challenge_id=c.id)>=3 or (select count(*) from public.challenge_generations where owner_id=p_owner and started_at>now()-interval '1 day')>=10 then raise exception 'Generation limit reached'; end if;
 insert into public.challenge_generations(challenge_id,owner_id,provider,model,prompt) values(c.id,p_owner,p_provider,p_model,p_prompt) returning id into result;
 update public.challenges set status='generating' where id=c.id;
 return result;
end $$;

create or replace function public.list_challenge_winners()
returns table (
 challenge_id uuid, caption_id uuid, caption text, origin text, upvotes bigint,
 closes_at timestamptz, situation text, image_path text, template_url text
)
language sql stable security definer set search_path='' as $$
 with eligible as (
   select c.id,c.creator_id,c.closes_at,c.situation,c.image_path,c.template_url
   from public.challenges c
   where (select auth.uid()) is not null
     and c.hidden_at is null and c.status='published' and c.closes_at <= statement_timestamp()
 ), scores as (
   select c.id as challenge_id, x.id as caption_id, x.body as caption, x.origin,
     count(v.user_id) as upvotes, c.closes_at,c.situation,c.image_path,c.template_url
   from eligible c
   join public.challenge_captions x on x.challenge_id=c.id
   left join public.challenge_votes v on v.challenge_id=c.id and v.caption_id=x.id
     and v.user_id<>c.creator_id
   group by c.id,x.id,x.body,x.origin,c.closes_at,c.situation,c.image_path,c.template_url
 ), ranked as (
   select s.*, rank() over(partition by s.challenge_id order by s.upvotes desc) as place,
     count(*) over(partition by s.challenge_id) as candidates
   from scores s
 )
 select r.challenge_id,r.caption_id,r.caption,r.origin,r.upvotes,r.closes_at,
   r.situation,r.image_path,r.template_url
 from ranked r
 where r.place=1 and r.upvotes>0 and r.candidates=2
   and not exists(select 1 from ranked other where other.challenge_id=r.challenge_id
     and other.caption_id<>r.caption_id and other.place=1)
 order by r.closes_at desc,r.challenge_id
 limit 50;
$$;

commit;
