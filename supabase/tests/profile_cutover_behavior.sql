-- STAGING ONLY. Execute as postgres after migration 003, then again after cleanup.
-- Creates temporary Auth fixtures inside a rolled-back transaction. This is NOT
-- a Google login test and must not run where custom signup hooks have external effects.
-- No real Storage objects/files are created. Test real uploads separately in the UI.
begin;
select set_config('app.test_a', gen_random_uuid()::text, true),
       set_config('app.test_b', gen_random_uuid()::text, true),
       set_config('app.test_c', gen_random_uuid()::text, true);
insert into auth.users(id, email, raw_app_meta_data)
select current_setting('app.test_' || suffix)::uuid,
       current_setting('app.test_' || suffix) || '@example.invalid',
       '{"provider":"google","providers":["google"]}'::jsonb
from unnest(array['a','b','c']) suffix;

do $$
begin
  assert (select count(*) = 3 from public.profiles
    where id in (current_setting('app.test_a')::uuid,current_setting('app.test_b')::uuid,current_setting('app.test_c')::uuid)),
    'Signup must create private profiles';
  assert (select count(*) = 3 from public.member_profiles where not is_listed
    and profile_id in (current_setting('app.test_a')::uuid,current_setting('app.test_b')::uuid,current_setting('app.test_c')::uuid)),
    'Signup must create unlisted member rows';
end;
$$;

-- Database-only collection fixtures; no files are uploaded.
insert into public.profile_photos(profile_id, avatar_path)
select current_setting('app.test_' || suffix)::uuid,
       current_setting('app.test_' || suffix) || '/' || photo
from unnest(array['a','b']) suffix cross join unnest(array['old.gif','current.png']) photo;

-- Force a failure AFTER the private-row update to prove transactional rollback.
create function pg_temp.reject_cutover_test() returns trigger language plpgsql as $$
begin
  if new.favorite_joke = 'cutover-forced-failure' then
    raise exception 'Test-only constraint rejection' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger cutover_test_rejection before insert or update on public.member_profiles
for each row execute function pg_temp.reject_cutover_test();

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('app.test_a'), true),
       set_config('request.jwt.claims', json_build_object('sub',current_setting('app.test_a'),'role','authenticated')::text, true);
do $$
begin
  assert (select count(*) = 1 from public.member_profiles), 'Incomplete user sees own member row only';
  assert (select count(*) = 1 from public.profiles), 'Private identity must be owner-only';
  assert (select count(*) = 2 from public.profile_photos), 'Collection must be owner-only';
end;
$$;
select public.save_my_profile('First A','Last A','Joke A',current_setting('app.test_a') || '/current.png',false);
select public.save_my_profile('First A','Last A','Restored joke',current_setting('app.test_a') || '/old.gif',false);
do $$
begin
  assert (select current_avatar_path = current_setting('app.test_a') || '/old.gif'
    and favorite_joke = 'Restored joke' and is_listed
    from public.member_profiles where profile_id=auth.uid()), 'Restore must save presentation and eligibility';
  assert (select count(*) = 2 from public.profile_photos), 'Restore must retain both photos';
  begin
    perform public.save_my_profile('Overwrite','Attempt','Bad',current_setting('app.test_b') || '/old.gif',false);
    raise exception 'Cross-owner photo accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_my_profile('Overwrite','Attempt','Bad',current_setting('app.test_a') || '/missing.png',false);
    raise exception 'Unknown collection photo accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_my_profile('Overwrite','Attempt','Bad',current_setting('app.test_a') || '/missing.png',true);
    raise exception 'Nonexistent upload accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_my_profile('','Last','Bad',null,false);
    raise exception 'Blank name accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.save_my_profile('Must roll back','Last','cutover-forced-failure',
      current_setting('app.test_a') || '/current.png',false);
    raise exception 'Expected downstream rejection did not happen';
  exception when check_violation then null;
  end;
  assert (select first_name = 'First A' from public.profiles where id=auth.uid()), 'Failed save changed private fields';
  assert (select favorite_joke = 'Restored joke' from public.member_profiles where profile_id=auth.uid()),
    'Failed save changed member fields';
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('app.test_b'), true),
       set_config('request.jwt.claims', json_build_object('sub',current_setting('app.test_b'),'role','authenticated')::text, true);
do $$
begin
  assert not exists(select 1 from public.member_profiles where profile_id=current_setting('app.test_a')::uuid),
    'Incomplete B must not see completed A';
end;
$$;
select public.save_my_profile('First B','Last B','Joke B',current_setting('app.test_b') || '/current.png',false);
do $$
begin
  assert (select count(*) = 2 from public.member_profiles
    where profile_id in (current_setting('app.test_a')::uuid,current_setting('app.test_b')::uuid,current_setting('app.test_c')::uuid)), 'Completed members can see A and B, not incomplete C';
  assert not exists(select 1 from public.profiles where id=current_setting('app.test_a')::uuid), 'B sees A identity';
  assert not exists(select 1 from public.profile_photos where profile_id=current_setting('app.test_a')::uuid), 'B sees A collection';
  begin
    update public.member_profiles set is_listed=true where profile_id=current_setting('app.test_c')::uuid;
    raise exception 'Direct membership mutation accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
update auth.users set email=id::text || '-changed@example.invalid' where id=current_setting('app.test_a')::uuid;
update public.profiles set first_name=null where id=current_setting('app.test_a')::uuid;
do $$
begin
  assert (select p.email=u.email from public.profiles p join auth.users u using(id)
    where p.id=current_setting('app.test_a')::uuid), 'Auth email synchronization failed';
  assert (select not is_listed and favorite_joke='Restored joke'
    and current_avatar_path=current_setting('app.test_a') || '/old.gif'
    from public.member_profiles where profile_id=current_setting('app.test_a')::uuid),
    'Name changes must change eligibility without losing presentation';
end;
$$;
set local role anon;
select set_config('request.jwt.claim.sub','',true), set_config('request.jwt.claims','{}',true);
do $$
begin
  begin
    perform public.save_my_profile('Anon','Caller',null,null,false);
    raise exception 'Anonymous save accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.member_profiles;
    raise exception 'Anonymous directory read accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- Account deletion must cascade to both new tables; verify in the same rollback.
delete from auth.users where id=current_setting('app.test_a')::uuid;
do $$
begin
  assert not exists(select 1 from public.member_profiles where profile_id=current_setting('app.test_a')::uuid),
    'Account deletion left a member row';
  assert not exists(select 1 from public.profile_photos where profile_id=current_setting('app.test_a')::uuid),
    'Account deletion left collection rows';
end;
$$;
rollback;
