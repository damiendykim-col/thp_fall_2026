# Database maintenance — October 10, 2026 UTC

Project: `uiakihcaipqkqbvvnsub`. Changes authorized in chat.

## Applied

- GIF migration: immutable frame representations, moderator approval, private bucket allowing JPEG/GIF up to 3 MiB.
- Templates: revoked PUBLIC/anon/authenticated table privileges, restored SELECT only for anon/authenticated.
- Added `challenge_generations(challenge_id)` index.
- Recorded vector extension in migrations; hosted vector 0.8.2 already existed.
- Reconciled hosted migration history with 17 canonical repository versions. Old migrations were **not replayed**. Historical entries record adoption of the existing schema, not execution on this date.
- Promoted the E2E images bootstrap and already-completed profile cutover into the canonical migration directory using their existing local versions. Removed the duplicate images file and replaced the old manual cutover entry point with a non-executable pointer.

Before history reconciliation, compared local/hosted application column types and nullability (excluding the known original images differences), all 27 public function definition hashes, function signatures/execute privileges/search paths, and five application trigger definitions. Functions and triggers matched. Reviewed hosted RLS policies and grants. This is not a complete byte-for-byte schema dump comparison.

Known original images drift: hosted description is NOT NULL with an empty-string default, image_url has an empty-string default and unique constraint, and the equivalent SELECT policy has a different name. The promoted bootstrap retains its historical local shape; history alignment alone does not erase these differences. Reconcile these through a future forward migration if exact schema parity is needed.

## Legacy content returned to review

Two published template challenges lack human/AI moderation records:

- `dc41febe-3f20-4f69-9fda-cbbe9c73257d`: also lacks the newer image-description field; one vote.
- `6cff1cca-3532-43b4-88f9-ef5dd2703671`: description present; one vote.

The third published challenge has human and AI moderation references. Template challenges do not require an uploaded-image record. Do not classify all NULL image_id values as broken data.

Follow-up authorized October 9, 2026 America/Phoenix: return both challenges to creator review and remove their existing votes. Applied `supabase/manual/20261010_requeue_legacy_challenges.sql` atomically with locked-state assertions. Both now have status `ready`, NULL publication/deadline timestamps, zero votes, and their two original captions. Exactly two votes were removed. The third challenge remains published with its one vote. Creators can publish through the existing action, which runs caption moderation before opening a fresh 24-hour round. This uses the creator's ready-to-publish workflow, not the moderator reports queue.

The internal `create_caption_challenge` function is still called by `create_reviewed_challenge` and tests; it is not dead code. Keep it. Preserve historical migration files and rollout documents as audit history.

## Verification / future deployments

Use `supabase/tests/grants_and_gif_verify.sql` for read-only assertions. Local setup uses only the canonical migration directory now. Hosted bucket remains private. No user account, caption, or storage object was deleted; only the two explicitly authorized legacy votes were removed.

For future migrations, commit the SQL and apply it once. MCP assigns a new timestamp; if applying an existing repository migration through MCP, reconcile that timestamp deliberately with the repository version after verifying success. Never blindly push old migrations into a manually provisioned database.

One-time history repair SQL is retained at `supabase/manual/20261010_reconcile_history.sql`; it is not part of the replayable migration sequence.
