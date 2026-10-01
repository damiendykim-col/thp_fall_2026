begin;

-- Apply after 202610010001_profiles.sql, whether that migration was run
-- earlier or immediately before this one.
alter table public.profiles add column email text;

update public.profiles as profile
set email = auth_user.email
from auth.users as auth_user
where profile.id = auth_user.id;

-- Do not invent placeholder addresses for accounts without an email.
do $$
begin
  if exists (select 1 from public.profiles where email is null or btrim(email) = '') then
    raise exception 'Some Auth users have no email. Set their email in Supabase Auth before applying this migration.';
  end if;
end;
$$;

alter table public.profiles alter column email set not null;
alter table public.profiles add constraint profile_email_not_blank
  check (btrim(email) <> '');

-- Auth is the source of truth; names remain nullable and user-editable.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create function public.sync_profile_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;
revoke execute on function public.sync_profile_email() from public, anon, authenticated;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.sync_profile_email();

-- Existing column-level grants permit updates only to names and avatar_path.
-- Clients cannot overwrite this Auth-managed email field.
commit;
