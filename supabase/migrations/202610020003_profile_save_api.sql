-- Run after 202610020002. Safe to apply before deploying the new app.
-- Legacy columns remain the write source until the separate manual cleanup.
begin;
set local lock_timeout = '10s';

drop policy "Read own member profile" on public.member_profiles;
drop policy "Completed members read listed profiles" on public.member_profiles;
create policy "Read own or listed member profiles" on public.member_profiles
for select to authenticated using (
  profile_id = (select auth.uid())
  or (
    is_listed and exists (
      select 1 from public.profiles viewer
      where viewer.id = (select auth.uid())
        and btrim(coalesce(viewer.first_name, '')) <> ''
        and btrim(coalesce(viewer.last_name, '')) <> ''
    )
  )
);

-- Intentionally privileged: table writes stay unavailable to clients after
-- cleanup. The only target is auth.uid(); there is no user-id argument.
create or replace function public.save_my_profile(
  p_first_name text,
  p_last_name text,
  p_favorite_joke text default null,
  p_avatar_path text default null,
  p_avatar_is_upload boolean default false
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  first_text text := btrim(p_first_name);
  last_text text := btrim(p_last_name);
  joke_text text := nullif(btrim(p_favorite_joke), '');
  old_path text;
begin
  if caller is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if first_text is null or first_text = '' or char_length(first_text) > 80
    or last_text is null or last_text = '' or char_length(last_text) > 80
    or char_length(joke_text) > 280
    or p_avatar_is_upload is null
    or (p_avatar_is_upload and p_avatar_path is null) then
    raise exception 'Invalid profile fields' using errcode = '22023';
  end if;
  -- Serialize saves for this user, including the read of the current photo.
  perform 1 from public.profiles where id = caller for update;
  if not found then raise exception 'Profile missing'; end if;

  if p_avatar_path is not null then
    if split_part(p_avatar_path, '/', 1) <> caller::text then
      raise exception 'Photo belongs to another user' using errcode = '42501';
    end if;
    if p_avatar_is_upload then
      -- A caller cannot register an arbitrary path just by claiming an upload.
      -- Storage creates owner_id from the authenticated upload token.
      if not exists (
        select 1 from storage.objects
        where bucket_id = 'avatars' and name = p_avatar_path and owner_id = caller::text
      ) then raise exception 'Owned upload not found' using errcode = '42501'; end if;
    elsif not exists (
      select 1 from public.profile_photos
      where profile_id = caller and avatar_path = p_avatar_path
    ) then raise exception 'Photo not in collection' using errcode = '42501';
    end if;
  end if;
  select avatar_path into old_path from public.profiles where id = caller;
  if p_avatar_path is not null and old_path is not null and p_avatar_path <> old_path then
    insert into public.profile_avatar_history(profile_id, avatar_path)
    values (caller, old_path) on conflict (profile_id, avatar_path) do nothing;
  end if;
  update public.profiles set
    first_name = first_text, last_name = last_text, favorite_joke = joke_text,
    avatar_path = coalesce(p_avatar_path, avatar_path)
  where id = caller;
  return caller;
end;
$$;
revoke execute on function public.save_my_profile(text, text, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.save_my_profile(text, text, text, text, boolean)
  to authenticated;

notify pgrst, 'reload schema';
commit;
