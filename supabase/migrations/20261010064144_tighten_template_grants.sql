begin;
-- Public templates are read-only. RLS is not a substitute for table privileges.
revoke all on table public.images from public, anon, authenticated;
grant select on table public.images to anon, authenticated;
create index if not exists challenge_generations_challenge on public.challenge_generations(challenge_id);
-- The extension is infrastructure only; no embedding model/dimensions chosen yet.
create extension if not exists vector with schema extensions;
commit;
