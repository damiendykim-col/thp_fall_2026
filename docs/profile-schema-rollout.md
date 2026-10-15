# Profile schema: completed rollout

The October 2 user-supplied verification confirmed normalization, RLS, expected
function/table grants and zero identity/eligibility mismatches. The owner then
confirmed UI validation. [October 10 maintenance](database-maintenance-2026-10-10.md)
recorded later hosted comparisons and canonical migration-history reconciliation.
These are dated observations, not a fresh hosted audit.

## Current contract

- `profiles`: owner-private names and non-null Auth-managed email.
- `member_profiles`: current avatar, favorite joke and server-derived listing
  eligibility. Completed members can discover eligible members; owners can read
  their own row. Names/emails are not part of discovery output.
- `profile_photos`: owner-private collection of reusable photo paths. Current-photo
  references are owner-qualified; one user cannot select another user's upload.
- Auth signup creates the private profile; the identity trigger creates/maintains
  its member row. Email updates synchronize from Auth. Client input cannot change
  email or eligibility directly.
- `save_my_profile` is the authenticated, ownership-checked atomic write API.
  API roles have no direct table/column write grants. Trigger functions are not
  callable by browser roles.
- Owners can access their photo collection; other eligible members can access only
  current listed avatars. Existing signed URLs remain usable until expiry.

Names remain nullable in storage, but login currently routes incomplete profiles
through onboarding and Members enforces completeness. Optional onboarding has not
been implemented. Profile saves use last-successful-save behavior; challenge draft
revision conflict detection does not apply to the profile editor.

## Migration and verification

Use [deployment](deployment.md). The canonical sequence includes the completed
cutover as `202610020004_finish_profile_cutover.sql`. The old manual entry point
is a non-executable pointer. Do not rerun historical cleanup against the existing
database, restore legacy columns, or redeploy pre-cutover writers.

Retain `supabase/tests/profile_cutover_verify.sql` for structural checks and the
local E2E suite for signup, saves, history and cross-account access behavior. Real
Google signup/email configuration and hosted Storage still need release checks.
A privileged SQL catalog query alone does not prove API authorization.

The [archived execution history](archive/profile-cutover-history.md) preserves the
original staged plan, intermediate pending checks and supplied verification. Those
unchecked boxes are historical evidence, not remaining work. No new profile
restructuring is scheduled.
