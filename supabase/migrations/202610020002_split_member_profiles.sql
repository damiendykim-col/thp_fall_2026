-- PHASE 1: additive, backward-compatible schema split.
-- Run as postgres AFTER migrations 202610010001 through 202610010005.
-- Run once. Existing app remains the writer through profiles/history.
-- Do not drop legacy columns or change the app to write the new tables yet.
begin;
set local lock_timeout = '10s';
-- Prevent concurrent saves from racing backfill/trigger installation.
lock table public.profiles, public.profile_avatar_history in share row exclusive mode;

create table public.profile_photos (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  avatar_path text not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, avatar_path),
  constraint photo_owned_path check (split_part(avatar_path, '/', 1) = profile_id::text)
);
create table public.member_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  current_avatar_path text,
  favorite_joke text check (favorite_joke is null or (char_length(favorite_joke) <= 280 and btrim(favorite_joke) <> '')),
  -- Derived by a trigger from private names, never writable by API users.
  is_listed boolean not null default false,
  foreign key (profile_id, current_avatar_path)
    references public.profile_photos(profile_id, avatar_path)
);
alter table public.profile_photos enable row level security;
alter table public.member_profiles enable row level security;
revoke all on public.profile_photos, public.member_profiles from public, anon, authenticated;
grant select on public.profile_photos, public.member_profiles to authenticated;

create policy "Read own photo collection" on public.profile_photos
for select to authenticated using (profile_id = (select auth.uid()));
create policy "Read own member profile" on public.member_profiles
for select to authenticated using (profile_id = (select auth.uid()));
create policy "Completed members read listed profiles" on public.member_profiles
for select to authenticated using (
  is_listed and exists (
    -- profiles RLS restricts this lookup to the caller's private row.
    select 1 from public.profiles viewer
    where viewer.id = (select auth.uid())
      and btrim(coalesce(viewer.first_name, '')) <> ''
      and btrim(coalesce(viewer.last_name, '')) <> ''
  )
);

-- Include CURRENT photos as well as history, without copying Storage objects.
insert into public.profile_photos(profile_id, avatar_path, created_at)
select profile_id, avatar_path, min(created_at)
from (
  select id as profile_id, avatar_path, created_at from public.profiles where avatar_path is not null
  union all
  select profile_id, avatar_path, created_at from public.profile_avatar_history
) photos group by profile_id, avatar_path;

insert into public.member_profiles(profile_id, current_avatar_path, favorite_joke, is_listed)
select id, avatar_path, favorite_joke,
  btrim(coalesce(first_name, '')) <> '' and btrim(coalesce(last_name, '')) <> ''
from public.profiles;

-- Compatibility writer: legacy profile saves update the new tables atomically.
-- Trigger functions cannot be used as ordinary RPCs and have no API grants.
create function public.sync_member_profile_from_legacy()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.avatar_path is not null then
    insert into public.profile_photos(profile_id, avatar_path) values (old.id, old.avatar_path)
    on conflict do nothing;
  end if;
  if new.avatar_path is not null then
    insert into public.profile_photos(profile_id, avatar_path) values (new.id, new.avatar_path)
    on conflict do nothing;
  end if;
  insert into public.member_profiles(profile_id, current_avatar_path, favorite_joke, is_listed)
  values (new.id, new.avatar_path, new.favorite_joke,
    btrim(coalesce(new.first_name, '')) <> '' and btrim(coalesce(new.last_name, '')) <> '')
  on conflict (profile_id) do update set
    current_avatar_path = excluded.current_avatar_path,
    favorite_joke = excluded.favorite_joke,
    is_listed = excluded.is_listed;
  return new;
end;
$$;
revoke execute on function public.sync_member_profile_from_legacy() from public, anon, authenticated;
create trigger sync_member_profile_from_legacy
  after insert or update of first_name, last_name, avatar_path, favorite_joke on public.profiles
  for each row execute function public.sync_member_profile_from_legacy();

create function public.sync_photo_history_from_legacy()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profile_photos(profile_id, avatar_path, created_at)
  values (new.profile_id, new.avatar_path, new.created_at)
  on conflict do nothing;
  return new;
end;
$$;
revoke execute on function public.sync_photo_history_from_legacy() from public, anon, authenticated;
create trigger sync_photo_history_from_legacy after insert on public.profile_avatar_history
  for each row execute function public.sync_photo_history_from_legacy();

-- Same RPC signature for today's app; caller RLS now provides directory access.
-- Retain the completed-viewer check: the owner-read policy alone permits an
-- incomplete user to see their own member_profiles row, but not the directory.
create or replace function public.list_member_profiles()
returns table(id uuid, avatar_path text, favorite_joke text)
language sql stable security invoker set search_path = '' as $$
  select member.profile_id, member.current_avatar_path, member.favorite_joke
  from public.member_profiles member
  where member.is_listed and exists (
    select 1 from public.profiles viewer
    where viewer.id = (select auth.uid())
      and btrim(coalesce(viewer.first_name, '')) <> ''
      and btrim(coalesce(viewer.last_name, '')) <> ''
  );
$$;
revoke execute on function public.list_member_profiles() from public, anon;
grant execute on function public.list_member_profiles() to authenticated;

-- Other members may sign/download ONLY listed current photos. Owners retain
-- the existing "Read own avatar" policy for their entire collection.
drop policy if exists "Read members current avatar" on storage.objects;
drop policy if exists "Authenticated users can view avatars" on storage.objects;
create policy "Read members current avatar" on storage.objects
for select to authenticated using (
  bucket_id = 'avatars' and exists (
    select 1 from public.member_profiles member
    where member.current_avatar_path = storage.objects.name and member.is_listed
      and exists (
        select 1 from public.profiles viewer
        where viewer.id = (select auth.uid())
          and btrim(coalesce(viewer.first_name, '')) <> ''
          and btrim(coalesce(viewer.last_name, '')) <> ''
      )
  )
);

-- Abort the whole transaction if backfill lost or changed a current value.
do $$
begin
  if exists (
    select 1 from public.profiles p left join public.member_profiles m on m.profile_id = p.id
    where m.profile_id is null or p.avatar_path is distinct from m.current_avatar_path
      or p.favorite_joke is distinct from m.favorite_joke
  ) then raise exception 'Member profile backfill mismatch'; end if;
  if exists (
    select 1 from public.profile_avatar_history h
    where not exists (select 1 from public.profile_photos p
      where p.profile_id = h.profile_id and p.avatar_path = h.avatar_path)
  ) then raise exception 'Photo collection backfill mismatch'; end if;
end;
$$;
commit;
