begin;

-- The old policy queried profiles as the caller, whose RLS hides other users.
-- list_member_profiles is a restricted SECURITY DEFINER function that returns
-- only directory fields and requires a completed profile for the caller.
drop policy if exists "Read members current avatar" on storage.objects;

-- Replace the dashboard policy shown during diagnosis. Its operation filter
-- excludes signing and its bucket-wide download access exposes photo history.
drop policy if exists "Authenticated users can view avatars" on storage.objects;

create policy "Read members current avatar" on storage.objects
for select to authenticated
using (
  bucket_id = 'avatars'
  and exists (
    select 1
    from public.list_member_profiles() as member
    where member.avatar_path = storage.objects.name
  )
);

-- Keep "Read own avatar" unchanged: owners can still read their photo history.
-- No operation filter: SELECT must also authorize createSignedUrl.
commit;
