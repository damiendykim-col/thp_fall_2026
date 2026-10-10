-- Read-only assertions, safe on local or hosted Postgres.
do $$
declare api_role text;
begin
  foreach api_role in array array['anon','authenticated'] loop
    if not has_table_privilege(api_role,'public.images','SELECT')
      or has_table_privilege(api_role,'public.images','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
      raise exception 'Unexpected template privileges: %',api_role;
    end if;
  end loop;
  if not exists(select 1 from storage.buckets where id='challenge-images'
    and not public and file_size_limit=3145728 and allowed_mime_types @> array['image/jpeg','image/gif']) then
    raise exception 'GIF bucket configuration missing';
  end if;
  if to_regclass('public.challenge_generations_challenge') is null
    or to_regprocedure('public.review_challenge_gif(uuid,boolean)') is null then
    raise exception 'Migration incomplete';
  end if;
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and not c.relrowsecurity) then
    raise exception 'Public table missing RLS';
  end if;
end $$;
