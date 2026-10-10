begin;
alter table public.challenge_images
 add column media_format text not null default 'jpeg' check(media_format in ('jpeg','gif')),
 add column selected_frames integer[],
 add column frame_count integer,
 add column animation_review text not null default 'pending' check(animation_review in ('pending','approved','rejected')),
 add column animation_reviewed_by uuid references public.profiles(id) on delete set null,
 add column animation_reviewed_at timestamptz;
alter table public.challenge_images add constraint gif_frames_required check (
 (media_format='jpeg' and selected_frames is null and frame_count is null) or
 (media_format='gif' and frame_count between 1 and 120 and cardinality(selected_frames) between 1 and 8)
);
update storage.buckets set allowed_mime_types=array['image/jpeg','image/gif'],file_size_limit=3145728 where id='challenge-images';

-- Optional arguments preserve existing still-image callers. Only trusted server code may reserve.
drop function public.reserve_challenge_image(uuid,text);
create function public.reserve_challenge_image(p_owner uuid,p_hash text,p_format text default 'jpeg',p_frames integer[] default null,p_count integer default null)
returns public.challenge_images language plpgsql security definer set search_path='' as $$
declare image public.challenge_images; image_id uuid:=gen_random_uuid();
begin
 perform 1 from public.profiles where id=p_owner for update;
 if not found then raise exception 'Profile required'; end if;
 if p_format not in ('jpeg','gif') or p_format is null then raise exception 'Invalid format'; end if;
 if p_format='gif' and (p_count is null or p_count not between 1 and 120 or p_frames is null or cardinality(p_frames) not between 1 and 8
  or exists(select 1 from unnest(p_frames) f where f is null or f<0 or f>=p_count)
  or (select count(distinct f) from unnest(p_frames) f)<>cardinality(p_frames)) then raise exception 'Invalid frames'; end if;
 select * into image from public.challenge_images where owner_id=p_owner and content_hash=p_hash;
 if found then return image; end if;
 if (select count(*) from public.challenge_images where owner_id=p_owner and created_at>now()-interval '1 day')>=10 then raise exception 'Daily image limit reached'; end if;
 insert into public.challenge_images(id,owner_id,content_hash,storage_path,media_format,selected_frames,frame_count)
 values(image_id,p_owner,p_hash,p_owner::text||'/'||image_id::text||case when p_format='gif' then '.gif' else '.jpg' end,p_format,p_frames,p_count) returning * into image;
 return image;
end $$;
revoke all on function public.reserve_challenge_image(uuid,text,text,integer[],integer) from public,anon,authenticated;
grant execute on function public.reserve_challenge_image(uuid,text,text,integer[],integer) to service_role;

-- Prevent an old challenge from silently acquiring a different AI representation.
create function public.freeze_challenge_image_representation() returns trigger language plpgsql set search_path='' as $$
begin
 if (old.storage_path,old.content_hash,old.media_format,old.selected_frames,old.frame_count) is distinct from
 (new.storage_path,new.content_hash,new.media_format,new.selected_frames,new.frame_count) then raise exception 'Image representation is immutable'; end if;
 return new;
end $$;
create trigger freeze_image_representation before update on public.challenge_images for each row execute function public.freeze_challenge_image_representation();
revoke all on function public.freeze_challenge_image_representation() from public,anon,authenticated;

-- Enforce this at the database write boundary, including direct publish RPC calls.
create function public.require_gif_publication_review() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='published' and new.image_path like '%.gif' and not exists (
  select 1 from public.challenge_images i where i.id=new.image_id and i.owner_id=new.creator_id and i.storage_path=new.image_path and i.media_format='gif' and i.animation_review='approved'
 ) then raise exception 'The full GIF needs moderator approval before publication'; end if;
 return new;
end $$;
create trigger gif_publication_review before insert or update of status on public.challenges for each row execute function public.require_gif_publication_review();
revoke all on function public.require_gif_publication_review() from public,anon,authenticated;

create function public.list_unreviewed_gifs() returns table(id uuid,storage_path text) language plpgsql security definer set search_path='' as $$
begin
 if not public.is_moderator() then raise exception 'Moderator required'; end if;
 return query select i.id,i.storage_path from public.challenge_images i where i.media_format='gif' and i.upload_ready and i.animation_review='pending' order by i.created_at limit 50;
end $$;
create function public.review_challenge_gif(p_image uuid,p_approved boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_moderator() then raise exception 'Moderator required'; end if;
 if p_approved is null then raise exception 'Decision required'; end if;
 update public.challenge_images set animation_review=case when p_approved then 'approved' else 'rejected' end,
 animation_reviewed_by=(select auth.uid()),animation_reviewed_at=now()
 where id=p_image and media_format='gif' and upload_ready and animation_review='pending';
 if not found then raise exception 'Review unavailable'; end if;
end $$;
revoke all on function public.list_unreviewed_gifs(),public.review_challenge_gif(uuid,boolean) from public,anon;
grant execute on function public.list_unreviewed_gifs(),public.review_challenge_gif(uuid,boolean) to authenticated;
-- Moderators can review complete uploaded GIFs, never users' avatar history.
create policy "Moderators inspect uploaded GIFs" on storage.objects for select to authenticated
 using(bucket_id='challenge-images' and name like '%.gif' and public.is_moderator());
commit;
