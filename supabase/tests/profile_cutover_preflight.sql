-- Read-only. Run BEFORE migration 003 and before approving manual cleanup.
-- Return all result sets; do not send email addresses or authentication tokens.
begin transaction read only;
select n.nspname as schema_name, c.relname as table_name, t.tgname,
  t.tgenabled, pg_get_triggerdef(t.oid) as definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal and (
  (n.nspname = 'auth' and c.relname = 'users') or
  (n.nspname = 'public' and c.relname in ('profiles', 'profile_avatar_history', 'member_profiles', 'profile_photos'))
)
order by schema_name, table_name, t.tgname;

select n.nspname as schema_name, p.proname, pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in (
  'handle_new_user', 'sync_profile_email', 'sync_member_profile_from_legacy',
  'sync_photo_history_from_legacy', 'save_my_profile', 'sync_member_identity', 'list_member_profiles'
);

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where
  (schemaname = 'public' and tablename in ('profiles','member_profiles','profile_photos','profile_avatar_history'))
  or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

select 'private_member_mismatch' as check_name, count(*) as failures
from public.profiles p left join public.member_profiles m on m.profile_id = p.id
where m.profile_id is null or p.avatar_path is distinct from m.current_avatar_path
  or p.favorite_joke is distinct from m.favorite_joke
  or m.is_listed is distinct from (
    btrim(coalesce(p.first_name, '')) <> '' and btrim(coalesce(p.last_name, '')) <> '')
union all
select 'missing_history_photo', count(*) from public.profile_avatar_history h
where not exists (select 1 from public.profile_photos c
  where c.profile_id = h.profile_id and c.avatar_path = h.avatar_path)
union all
select 'auth_profile_mismatch', count(*) from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null or p.email is distinct from u.email;
rollback;
