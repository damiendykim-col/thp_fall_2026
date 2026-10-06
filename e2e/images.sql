-- Only for the isolated E2E database: Assignment 2's dashboard-created table.
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
