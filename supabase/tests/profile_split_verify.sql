-- Run as postgres AFTER both October 2 migrations. Read-only checks.
begin read only;
-- All rows should report false for anon permissions, true for expected RLS.
select table_name, row_security
from (
  select c.relname as table_name, c.relrowsecurity as row_security
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in
    ('profiles', 'profile_avatar_history', 'profile_photos', 'member_profiles')
) tables order by table_name;

select function_name,
  has_function_privilege('anon', function_name, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', function_name, 'EXECUTE') as authenticated_execute
from (values
  ('public.rls_auto_enable()'), ('public.list_member_profiles()'),
  ('public.sync_member_profile_from_legacy()'), ('public.sync_photo_history_from_legacy()')
) functions(function_name);
-- Only list_member_profiles should have authenticated_execute=true.
select proname, prosecdef as security_definer, proconfig
from pg_proc where oid in (
  'public.rls_auto_enable()'::regprocedure, 'public.list_member_profiles()'::regprocedure,
  'public.sync_member_profile_from_legacy()'::regprocedure,
  'public.sync_photo_history_from_legacy()'::regprocedure
);
-- list_member_profiles.security_definer must be false.
select evtname, evtevent, evtenabled, evttags
from pg_event_trigger where evtfoid = 'public.rls_auto_enable()'::regprocedure;

-- Each mismatch count must be zero.
select count(*) as current_value_mismatches
from public.profiles p left join public.member_profiles m on m.profile_id = p.id
where m.profile_id is null or p.avatar_path is distinct from m.current_avatar_path
  or p.favorite_joke is distinct from m.favorite_joke
  or m.is_listed is distinct from
    (btrim(coalesce(p.first_name, '')) <> '' and btrim(coalesce(p.last_name, '')) <> '');
select count(*) as missing_history_photos
from public.profile_avatar_history h where not exists (
  select 1 from public.profile_photos p where p.profile_id = h.profile_id and p.avatar_path = h.avatar_path
);

-- No API role should have direct writes to the new tables in phase 1.
select name,
  has_table_privilege('anon', name, 'SELECT') as anon_read,
  has_table_privilege('authenticated', name, 'INSERT') as authenticated_insert,
  has_table_privilege('authenticated', name, 'UPDATE') as authenticated_update,
  has_table_privilege('authenticated', name, 'DELETE') as authenticated_delete
from (values ('public.member_profiles'), ('public.profile_photos')) tables(name);

-- Review ALL policies: additional permissive policies combine with OR.
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where (schemaname = 'public' and tablename in
  ('profiles','profile_avatar_history','member_profiles','profile_photos'))
  or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;
rollback;
