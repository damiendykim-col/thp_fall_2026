-- Run as postgres in Supabase SQL Editor. Independent of the profile migration.
-- Applies to FUTURE public-table creation; does not repair existing tables.
begin;
create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql security definer set search_path = pg_catalog
as $$
declare cmd record;
begin
  for cmd in
    select * from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name = 'public' then
      execute format('alter table if exists %s enable row level security', cmd.object_identity);
      raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
    end if;
  end loop;
  -- Deliberately do not catch errors: failure aborts table creation.
end;
$$;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Preserve an existing enabled binding; establish one if none exists.
-- An enabled trigger with different event/tag filtering should be inspected first.
do $$
begin
  if not exists (
    select 1 from pg_event_trigger
    where evtfoid = 'public.rls_auto_enable()'::regprocedure
      and evtenabled in ('O', 'A') and evtevent = 'ddl_command_end'
      and (evttags is null or evttags @> array['CREATE TABLE','CREATE TABLE AS','SELECT INTO']::text[])
  ) then
    if exists (select 1 from pg_event_trigger where evtname = 'ensure_rls') then
      raise exception 'ensure_rls exists but is not the expected enabled binding; inspect it before proceeding';
    end if;
    create event trigger ensure_rls on ddl_command_end
      when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      execute function public.rls_auto_enable();
  end if;
end;
$$;
commit;
