-- Historical bootstrap promoted from the isolated E2E setup.
-- Hosted Assignment 2 table already exists; reconcile history, do not replay.
create table public.images (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  description text,
  created_at timestamptz not null default now()
);
alter table public.images enable row level security;
revoke all on public.images from public, anon, authenticated;
grant select on public.images to anon, authenticated;
create policy "Read gallery images" on public.images for select to anon, authenticated using (true);
