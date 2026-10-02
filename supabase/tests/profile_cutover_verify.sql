-- Read-only; works both before and after manual cleanup.
begin transaction read only;
select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('profiles','member_profiles','profile_photos');

select
  has_function_privilege('anon', 'public.save_my_profile(text,text,text,text,boolean)', 'EXECUTE') as anon_save_must_be_false,
  has_function_privilege('authenticated', 'public.save_my_profile(text,text,text,text,boolean)', 'EXECUTE') as authenticated_save_must_be_true;
select n.nspname, p.proname, p.prosecdef, p.proconfig,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('save_my_profile','handle_new_user','sync_profile_email','sync_member_identity');

select count(*) as identity_or_eligibility_mismatches
from auth.users u left join public.profiles p on p.id=u.id
left join public.member_profiles m on m.profile_id=p.id
where p.id is null or m.profile_id is null or p.email is distinct from u.email
  or m.is_listed is distinct from (
    btrim(coalesce(p.first_name,'')) <> '' and btrim(coalesce(p.last_name,'')) <> '');

-- After final cleanup, all three legacy-object results must be NULL.
select to_regclass('public.profile_avatar_history') as legacy_history,
  to_regprocedure('public.list_member_profiles()') as legacy_directory,
  to_regprocedure('public.sync_member_profile_from_legacy()') as legacy_sync;

-- After final cleanup, only SELECT privileges should remain on these tables/columns
-- for anon/authenticated (and anon should have none).
select table_name, grantee, privilege_type
from information_schema.table_privileges
where table_schema='public' and table_name in ('profiles','member_profiles','profile_photos')
  and grantee in ('PUBLIC','anon','authenticated');
select table_name, column_name, grantee, privilege_type
from information_schema.column_privileges
where table_schema='public' and table_name in ('profiles','member_profiles','profile_photos')
  and grantee in ('PUBLIC','anon','authenticated') and privilege_type <> 'SELECT';
rollback;
