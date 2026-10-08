-- Apply after caption challenges and winners. Existing challenges retain their original context.
begin;
create table public.challenge_images (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
 storage_path text not null unique,
 upload_ready boolean not null default false,
 description_status text not null default 'pending' check (description_status in ('pending','running','succeeded','failed')),
 suggested_description text check (char_length(suggested_description) between 1 and 500),
 confirmed_description text check (char_length(confirmed_description) between 1 and 500),
 description_source text check (description_source in ('accepted','edited','replaced','manual')),
 provider text, model text, prompt jsonb, description_started_at timestamptz,
 created_at timestamptz not null default now(),
 unique(owner_id, content_hash),
 check (split_part(storage_path,'/',1)=owner_id::text)
);
create index challenge_images_quota on public.challenge_images(owner_id,created_at);
alter table public.challenge_images enable row level security;
revoke all on public.challenge_images from public, anon, authenticated;
grant select on public.challenge_images to authenticated;
grant all on public.challenge_images to service_role;
create policy "Read own challenge image descriptions" on public.challenge_images
 for select to authenticated using(owner_id=(select auth.uid()));

alter table public.challenges add column image_id uuid references public.challenge_images(id);
alter table public.challenges add column image_description text check(char_length(image_description) between 1 and 500);
alter table public.challenges add column joke_context text check(char_length(joke_context) between 1 and 500);
alter table public.challenges add column review_submission uuid unique;
alter table public.challenges add column description_source text check(description_source in ('accepted','edited','replaced','manual','template'));
create index challenges_reviewed_image on public.challenges(image_id);

create function public.reserve_challenge_image(p_owner uuid, p_hash text)
returns public.challenge_images language plpgsql security definer set search_path='' as $$
declare image public.challenge_images; image_id uuid := gen_random_uuid();
begin
 perform 1 from public.profiles where id=p_owner for update;
 if not found then raise exception 'Profile required'; end if;
 select * into image from public.challenge_images where owner_id=p_owner and content_hash=p_hash;
 if found then return image; end if;
 if (select count(*) from public.challenge_images where owner_id=p_owner and created_at>now()-interval '1 day')>=10 then
  raise exception 'Daily image limit reached';
 end if;
 insert into public.challenge_images(id,owner_id,content_hash,storage_path)
 values(image_id,p_owner,p_hash,p_owner::text||'/'||image_id::text||'.jpg') returning * into image;
 return image;
end $$;

-- Review metadata is calculated from the stored model output, never supplied as provenance by a browser.
create function public.create_reviewed_challenge(
 p_owner uuid,p_image_id uuid,p_template uuid,p_description text,p_context text,
 p_caption text,p_confirmed boolean,p_manual boolean,p_submission uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare image public.challenge_images; result uuid; source text; description text:=btrim(p_description); context text:=nullif(btrim(p_context),'');
begin
 perform 1 from public.profiles where id=p_owner for update;
 if not found then raise exception 'Profile required'; end if;
 if p_submission is null then raise exception 'Submission required'; end if;
 select id into result from public.challenges where review_submission=p_submission and creator_id=p_owner;
 if found then return result; end if;
 if p_confirmed is distinct from true or description is null or char_length(description) not between 1 and 500
    or char_length(coalesce(context,''))>500 then raise exception 'Confirm the image description'; end if;
 if (p_image_id is not null)::int + (p_template is not null)::int <> 1 then raise exception 'Choose one image'; end if;
 if p_image_id is not null then
  select * into image from public.challenge_images where id=p_image_id and owner_id=p_owner for update;
  if not found or not image.upload_ready then raise exception 'Image unavailable'; end if;
  -- A timed-out analysis may be abandoned in favor of manual text. Late results must not overwrite review.
  if image.description_status='running' then raise exception 'Description is still being generated'; end if;
 end if;
 result:=public.create_caption_challenge(p_owner,image.storage_path,p_template,coalesce(context,description),p_caption);
 source:=case when p_image_id is null then 'template'
  when image.suggested_description is null then 'manual' when p_manual then 'replaced'
  when image.suggested_description=description then 'accepted' else 'edited' end;
 update public.challenges set image_id=p_image_id,image_description=description,joke_context=context,
  review_submission=p_submission,description_source=source where id=result;
 if p_image_id is not null then
  update public.challenge_images set confirmed_description=description,
   description_source=source
   where id=p_image_id;
 end if;
 return result;
end $$;
revoke all on function public.reserve_challenge_image(uuid,text),public.create_reviewed_challenge(uuid,uuid,uuid,text,text,text,boolean,boolean,uuid) from public,anon,authenticated;
grant execute on function public.reserve_challenge_image(uuid,text),public.create_reviewed_challenge(uuid,uuid,uuid,text,text,text,boolean,boolean,uuid) to service_role;

-- Extend the existing safe reader without exposing raw analysis/provenance or blind attribution.
create or replace function public.read_caption_challenge(p_challenge uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.challenges; viewer uuid:=(select auth.uid()); closed boolean;
begin
 if viewer is null then return null; end if;
 select * into c from public.challenges where id=p_challenge and (status='published' or creator_id=viewer);
 if not found then return null; end if;
 closed:=c.status='published' and c.closes_at<=clock_timestamp();
 return jsonb_build_object('id',c.id,'own',c.creator_id=viewer,'status',c.status,'situation',c.situation,
 'image_description',c.image_description,'joke_context',c.joke_context,
 'image_path',c.image_path,'template_url',c.template_url,'closes_at',c.closes_at,'closed',closed,
 'vote',(select caption_id from public.challenge_votes where challenge_id=c.id and user_id=viewer),
 'captions',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'body',x.body,'origin',case when closed or (c.creator_id=viewer and c.status<>'published') then x.origin end,'votes',case when closed then (select count(*) from public.challenge_votes v where v.caption_id=x.id) end) order by md5(x.id::text||viewer::text)) from public.challenge_captions x where x.challenge_id=c.id),'[]'::jsonb));
end $$;
commit;
