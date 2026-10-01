begin;

alter table public.profiles
  add column favorite_joke text check (
    favorite_joke is null
    or char_length(favorite_joke) <= 280
    and btrim(favorite_joke) <> ''
  );

grant update (favorite_joke) on public.profiles to authenticated;

create table public.profile_avatar_history (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  avatar_path text not null,
  created_at timestamptz not null default now(),
  constraint avatar_history_belongs_to_profile check (
    split_part(avatar_path, '/', 1) = profile_id::text
  ),
  unique (profile_id, avatar_path)
);

alter table public.profile_avatar_history enable row level security;
revoke all on public.profile_avatar_history from anon, authenticated;
grant select, insert on public.profile_avatar_history to authenticated;
create policy "Read own avatar history" on public.profile_avatar_history for select to authenticated
  using ((select auth.uid()) = profile_id);
create policy "Insert own avatar history" on public.profile_avatar_history for insert to authenticated
  with check ((select auth.uid()) = profile_id);

create or replace function public.list_member_profiles()
returns table (id uuid, avatar_path text, favorite_joke text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.profiles viewer
    where viewer.id = (select auth.uid())
      and btrim(coalesce(viewer.first_name, '')) <> ''
      and btrim(coalesce(viewer.last_name, '')) <> ''
  ) then
    return;
  end if;

  return query
  select profile.id, profile.avatar_path, profile.favorite_joke
  from public.profiles profile
  where btrim(coalesce(profile.first_name, '')) <> ''
    and btrim(coalesce(profile.last_name, '')) <> '';
end;
$$;
revoke execute on function public.list_member_profiles() from public, anon;
grant execute on function public.list_member_profiles() to authenticated;

drop policy if exists "Read own avatar" on storage.objects;
create policy "Read own avatar" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Read members current avatar" on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars'
    and exists (
      select 1
      from public.profiles profile
      where profile.avatar_path = name
    )
    and exists (
      select 1
      from public.profiles viewer
      where viewer.id = (select auth.uid())
        and btrim(coalesce(viewer.first_name, '')) <> ''
        and btrim(coalesce(viewer.last_name, '')) <> ''
    )
  );

commit;
