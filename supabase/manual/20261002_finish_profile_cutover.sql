-- MANUAL, DESTRUCTIVE FINAL STAGE. Not in the automatic migration directory.
-- Apply ONLY after deploying the new app, verifying two accounts and a fresh
-- signup, retiring old deployments, and exporting the database.
-- User authorized final cleanup after reporting the cutover app working, Oct 2.
-- Run the entire file once. Follow docs/profile-schema-rollout.md.
begin;
set local lock_timeout = '10s';
set local app.profile_cleanup_confirmed = 'yes'; -- authorized final cleanup
do $$
begin
  if current_setting('app.profile_cleanup_confirmed') <> 'yes' then
    raise exception 'Deploy and verify cutover before confirming cleanup';
  end if;
  if to_regprocedure('public.save_my_profile(text,text,text,text,boolean)') is null then
    raise exception 'Apply migration 003 first';
  end if;
end;
$$;

-- Consistent lock order with signup/email updates: Auth first, then profiles.
lock table auth.users in share row exclusive mode;
lock table public.profiles, public.profile_avatar_history,
  public.profile_photos, public.member_profiles in share row exclusive mode;

-- Fail on data drift; never discard the legacy copy when parity is uncertain.
do $$
begin
  if exists (
    select 1 from public.profiles p left join public.member_profiles m on m.profile_id = p.id
    where m.profile_id is null or p.avatar_path is distinct from m.current_avatar_path
      or p.favorite_joke is distinct from m.favorite_joke
      or m.is_listed is distinct from (
        btrim(coalesce(p.first_name, '')) <> '' and btrim(coalesce(p.last_name, '')) <> '')
  ) then raise exception 'Profile parity check failed'; end if;
  if exists (
    select 1 from public.profile_avatar_history h where not exists (
      select 1 from public.profile_photos p
      where p.profile_id = h.profile_id and p.avatar_path = h.avatar_path
    )
  ) then raise exception 'Photo collection parity check failed'; end if;
  if exists (
    select 1 from auth.users u left join public.profiles p on p.id = u.id
    where p.id is null or p.email is distinct from u.email
  ) then raise exception 'Auth/profile parity check failed'; end if;
end;
$$;

drop trigger sync_member_profile_from_legacy on public.profiles;
drop trigger sync_photo_history_from_legacy on public.profile_avatar_history;
drop function public.sync_member_profile_from_legacy();
drop function public.sync_photo_history_from_legacy();

-- Permanent identity -> membership synchronization, independent of legacy data.
-- Does not copy presentation data or overwrite the selected photo/joke.
create function public.sync_member_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.member_profiles(profile_id, is_listed)
  values (new.id,
    btrim(coalesce(new.first_name, '')) <> '' and btrim(coalesce(new.last_name, '')) <> '')
  on conflict (profile_id) do update set is_listed = excluded.is_listed;
  return new;
end;
$$;
revoke execute on function public.sync_member_identity() from public, anon, authenticated;
create trigger sync_member_identity
after insert or update of first_name, last_name on public.profiles
for each row execute function public.sync_member_identity();

-- Re-establish the known Auth chain explicitly. Names remain nullable at signup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, email) values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
create or replace function public.sync_profile_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_profile_email() from public, anon, authenticated;
drop trigger on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();
drop trigger on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated after update of email on auth.users
for each row when (old.email is distinct from new.email)
execute function public.sync_profile_email();

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
  if p_avatar_path is not null then
    insert into public.profile_photos(profile_id, avatar_path)
    values (caller, p_avatar_path) on conflict do nothing;
  end if;
  -- Name/eligibility trigger also ensures the member row exists.
  update public.profiles set first_name = first_text, last_name = last_text where id = caller;
  update public.member_profiles set
    favorite_joke = joke_text,
    current_avatar_path = coalesce(p_avatar_path, current_avatar_path)
  where profile_id = caller;
  if not found then raise exception 'Member profile missing'; end if;
  return caller;
end;
$$;
revoke execute on function public.save_my_profile(text, text, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.save_my_profile(text, text, text, text, boolean)
  to authenticated;

-- Remove old direct writes (column privileges survive a table-level REVOKE).
revoke update on public.profiles from public, anon, authenticated;
revoke update (first_name, last_name, avatar_path, favorite_joke)
  on public.profiles from public, anon, authenticated;
drop policy "Update own profile" on public.profiles;

-- No CASCADE: unexpected dependencies must abort the transaction for review.
drop function public.list_member_profiles();
drop table public.profile_avatar_history;
alter table public.profiles drop column avatar_path, drop column favorite_joke;

-- Verify the final privilege boundary, including unexpected pre-existing grants.
-- This also covers the table-grant result omitted from the earlier export.
do $$
declare
  table_name text;
  api_role text;
begin
  foreach table_name in array array['public.profiles','public.member_profiles','public.profile_photos'] loop
    foreach api_role in array array['anon','authenticated'] loop
      if has_table_privilege(api_role, table_name, 'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
        or has_any_column_privilege(api_role, table_name, 'INSERT, UPDATE, REFERENCES') then
        raise exception 'Unexpected direct write grant for % on %; cleanup rolled back', api_role, table_name;
      end if;
    end loop;
    if has_table_privilege('anon', table_name, 'SELECT')
      or has_any_column_privilege('anon', table_name, 'SELECT') then
      raise exception 'Unexpected anonymous read grant on %; cleanup rolled back', table_name;
    end if;
    if not has_table_privilege('authenticated', table_name, 'SELECT') then
      raise exception 'Missing authenticated read grant on %; cleanup rolled back', table_name;
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
commit;
