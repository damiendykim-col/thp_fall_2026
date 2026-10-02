# Profile schema and RLS rollout

Updated October 2, 2026. Phase-1 triggers, function definitions, policies and data parity were confirmed
by the user's preflight results.
The app cutover is prepared locally. User-supplied verification now confirms the
new save function and its expected grants are present after migration 003. Final
cleanup and app deployment remain unconfirmed; no remote changes were made by the agent.

## Current rollout: next steps

1. Run [preflight](../supabase/tests/profile_cutover_preflight.sql) and review **all**
   result sets against the repository. This includes Auth signup/email triggers,
   compatibility functions, extra policies and parity counts (all counts must be 0).
   Preserve a schema/data/grants export before changes.
2. Apply [migration 003](../supabase/migrations/202610020003_profile_save_api.sql)
   before deploying this app version. It adds `save_my_profile` and consolidates
   the two member SELECT policies with the same OR conditions. The old app still
   works; existing compatibility triggers remain the only synchronization direction.
3. Deploy this version. New reads use `member_profiles` and `profile_photos`;
   saving calls one atomic RPC. During this stage the RPC writes legacy fields
   and the existing triggers update the new tables in that same transaction.
4. Run [verification](../supabase/tests/profile_cutover_verify.sql) and the
   two-account/fresh-Google-signup tests below. On a staging database, run
   [behavior checks](../supabase/tests/profile_cutover_behavior.sql) as well.
5. Retire old deployments/preview URLs and close or reload old client sessions.
   Export again. Only after successful checks, change the explicit confirmation
   setting in [manual final cleanup](../supabase/manual/20261002_finish_profile_cutover.sql)
   from `no` to `yes` and run the whole file. It is intentionally outside
   `supabase/migrations` so a migration push cannot drop live dependencies early.
6. Repeat verification and functional tests. Record the final SQL execution in
   your deployment log; do not run the single-use cleanup twice.

**Do not deploy the app before migration 003:** the new Save action needs its RPC.
If final cleanup fails, its transaction rolls back; run ROLLBACK in the SQL Editor
before investigating/retrying. It has a 10-second lock timeout and never uses CASCADE.
Preflight must be reviewed: parity checks do not detect arbitrary custom trigger
behavior or broadened grants that were added outside these migrations.

### What final cleanup changes

- Replaces legacy synchronization with a permanent `profiles → member_profiles`
  trigger that creates the member row on signup and derives listing eligibility
  from names. It leaves existing photo/joke values untouched on identity updates.
- Explicitly reinstalls `auth.users → profiles` signup and email-update functions
  and trigger bindings. First/last names stay nullable; email stays non-null and
  Auth-managed. A new signup therefore gets both rows atomically.
- Replaces the save RPC body with writes to the normalized tables, retains the
  same API signature and saves names, photo registration, current photo and joke
  atomically. A null photo argument means keep the current photo.
- Revokes direct client profile updates, including column grants. Removes legacy
  columns, history table, compatibility functions and unused directory RPC.
- Does not delete or move any Storage files. Current and previous photo paths,
  draft keys and the form's field names remain compatible.

### Authorization and operational details

`save_my_profile` intentionally uses SECURITY DEFINER: clients cannot independently
write membership eligibility or register arbitrary photos. It takes no user ID,
requires `auth.uid()`, fixes its search path and grants EXECUTE only to authenticated.
It validates all fields again in SQL, locks the caller's private row to serialize
saves, and accepts either an owner-qualified collection entry or a Storage object
in the caller's folder with the caller's `owner_id`. An uploaded path is not trusted
just because the client marks it as new. It never writes email.

Security Advisor may flag this **authenticated** definer RPC. That is an intentional,
reviewable privilege boundary, unlike a publicly callable administrative function.
Do not silence it by granting table writes or exposing it to anon.
See [Supabase function security](https://supabase.com/docs/guides/database/functions)
and [Storage ownership](https://supabase.com/docs/guides/storage/security/ownership).

Storage upload and SQL cannot share a transaction. The action removes a new upload
only after a definite database rejection. If the response is lost, it preserves the
file because the database may have committed; the user is told to reload before retry.
This may leave an unreferenced upload after a failed/ambiguous attempt. No automated
orphan deletion is included. Concurrent form saves use last-successful-save semantics;
row locking protects consistency, not conflict detection for stale edits.

### Required functional checks before and after final cleanup

- Fresh Google account: signup produces both rows, email matches Auth, names are null,
  onboarding appears; completing names enables membership.
- Account A: save names/joke together, clear the optional joke, upload GIF/PNG,
  restore an older photo, save again, navigate away/back and restore a text draft.
- Account B: see A's current photo/joke; direct API reads cannot expose A's private
  identity or photo collection, and photo selection cannot reference A's paths.
- Incomplete account: own editor works; other members remain inaccessible.
- Anonymous account: no profile/directory/collection reads or save RPC execution.
- Authorized staging email change: private email synchronizes; clearing a name hides
  the member without erasing photo/joke; completing it restores visibility.
- Real authenticated Storage upload works with `owner_id`; failures in the SQL save
  leave names and presentation unchanged. Retest signed avatar URLs using fresh URLs.

The behavior SQL uses rolled-back synthetic Auth rows, simulated JWT claims and
SET ROLE on staging only. It tests database rules, not OAuth, PostgREST schema
embedding or Storage uploads. Custom external signup hooks may still have side
effects even when SQL rolls back. Actual browser/API checks remain necessary.


## Decisions

Private identity remains in `profiles` (names and Auth-managed email).
`member_profiles` contains one current presentation row per user: photo path,
favorite joke, and a server-derived eligibility flag. `profile_photos` contains
all owned reusable photos, including current and historical ones. Its composite
primary key is `(profile_id, avatar_path)`; the current-photo foreign key includes
the owner so it cannot select another user's photo.

Photo paths reference existing Storage objects. The migration does not upload,
move, overwrite, or delete files. Existing creation timestamps are retained where
available; a current photo without historical metadata uses profile creation time,
which is not necessarily its actual upload time.

## Files and execution order

1. `supabase/migrations/202610020001_harden_auto_rls.sql`
   replaces the supplied event-trigger function with a fail-closed version,
   revokes browser-role EXECUTE grants, and ensures an enabled DDL binding exists.
2. `supabase/migrations/202610020002_split_member_profiles.sql`
   creates/backfills the new tables, installs compatibility triggers, replaces the
   member-list RPC with SECURITY INVOKER, and changes the known Storage policy.
3. `supabase/tests/profile_split_verify.sql`
   inspects grants, function modes, event-trigger bindings, RLS and backfill parity.
   It is read-only and does not prove actual API access on its own.

Run each entire file separately in Supabase SQL Editor as `postgres`, in order.
The existing October 1 migrations 001–005 must already be applied. If using the
Supabase CLI migration workflow instead, reconcile previously dashboard-applied
migrations first; do not blindly push the entire history. Migration 002 is
single-use: a duplicate-table error means inspect migration status, not delete
objects and retry. Both scripts are transactional. If a transaction aborts, run
ROLLBACK before retrying after fixing the cause. A failure in script 2 does not
undo an already committed script 1.

## Before running

- [ ] Preserve a database backup/export that includes schema, grants and policies.
- [ ] Confirm the target project is `uiakihcaipqkqbvvnsub`.
- [ ] Inspect live definitions against the repository, particularly profile triggers,
      `list_member_profiles`, and Storage policies. Extra permissive policies may
      allow access even when the new policies deny it.
- [ ] Prefer a staging run; otherwise use a quiet period. Script 2 briefly blocks
      profile/history writes during backfill and times out acquiring locks after
      10 seconds rather than waiting indefinitely.
- [ ] Capture existing current-photo paths/jokes and row counts for comparison.

The auto-RLS change deliberately aborts future public-table creation when enabling
RLS fails. Previously the supplied function logged and swallowed that error.
It does not scan or repair RLS on old tables, or create access policies for new ones.

## Phase 1: safe with the pre-cutover app

- [ ] Apply script 1.
- [ ] Apply script 2.
- [ ] Run verification SQL; mismatch counts must be zero.
- [ ] Re-run Security Advisor. The two auto-RLS execution warnings and the
      member-list SECURITY DEFINER warning should clear. Any other warnings need
      separate assessment. Password protection is unchanged.
- [ ] Sign in as account A: edit names/joke, upload, restore an old photo, sign out/in.
- [ ] Sign in as account B: see A's current photo/joke, never private names/email or
      A's historical photo collection. Test with newly requested signed URLs;
      already-issued signed URLs remain usable until expiry.
- [ ] With no session: no profile, photo-collection or directory access.
- [ ] With an incomplete profile: own private row remains accessible, but directory
      RPC returns no rows and other members' current photos cannot be newly signed.
- [ ] Newly registered users receive both private and member rows through triggers.
- [ ] Clear a first/last name in an authorized test account: its listing disappears;
      completing it again restores eligibility. Do not broaden table grants to test.
- [ ] Check logs and compare directory timing following deployment/SQL changes.

Security tests must include direct API requests using the public key plus the
appropriate user token, not only page navigation or SQL Editor's privileged role.
Test A attempting to update B and to select B's history. Do not share tokens in chat.

## Why compatibility columns remain

The pre-cutover application still reads/writes `profiles.avatar_path`,
`profiles.favorite_joke`, and `profile_avatar_history`. Removing them now would
break profile saving and drafts/photo restoration. Phase 1 therefore treats these
legacy columns as the ONLY write source, and triggers maintain the new tables in
the same transaction. The new tables grant SELECT only to authenticated clients.
Do not add direct write grants yet: dual independent writers would diverge.

This is an additive transition, not the completed physical removal of private /
member fields from the legacy table. Directory access already uses the new table
and caller RLS, so the privileged directory RPC is no longer necessary.

Access rules:
- Private profiles and the photo collection: owner reads only.
- Member profile: owner can read their own row even while incomplete; completed
  users can read eligible members. `is_listed` is derived from names by the trusted
  compatibility trigger; clients cannot directly change it.
- Directory RPC: preserves the old completed-viewer and completed-member behavior.
- Storage: owners retain own-photo access; completed members access only eligible
  members' current photos. The collection table does not grant access to files.
- Trigger functions remain SECURITY DEFINER with fixed search paths and no
  EXECUTE grants to API roles. Administrative synchronization stays internal.

## Phase 2 implementation status

- [x] New-table profile/directory/collection reads.
- [x] Single save RPC with database ownership validation.
- [x] Staged replacement of synchronization and explicit Auth trigger chain.
- [x] Existing draft and photo-path format retained.
- [x] Manual cleanup, preflight and verification artifacts prepared.
- [ ] SQL executed on staging / live Supabase.
- [ ] New app deployed after migration 003.
- [ ] Two-account API tests, real upload and fresh Google signup verified.
- [ ] Old deployments retired and manual cleanup applied.

The phase-1 source-of-truth description below is historical until final cleanup.
After final cleanup, legacy app rollback is no longer supported: restore a reviewed
database backup or forward-fix. Do not deploy an old build against the cleaned schema.

## Recovery

Before commit, transaction failure rolls back that script. After phase 1 commits,
the unchanged app remains compatible; no app rollback is required. If directory
access regresses, keep both new tables/data and restore the previous directory
function and known Storage policy definitions from the backup (or reviewed October
1 migration definitions). Reverting to SECURITY DEFINER restores its advisor warning.
Do not delete photos or disable RLS as a recovery step. Do not drop the compatibility
triggers while leaving clients writing legacy columns and expecting new-table reads.

## Validation record

- Cutover application: 52 tests across 10 suites pass; ESLint and production
  webpack build pass (including TypeScript).
- SQL runtime execution: NOT performed. PostgreSQL was unavailable locally and
  the temporary runtime download was declined. SQL behavior checks are supplied
  for staging; they are not evidence of a passing database test.
- No remote database changes, deployment, commit or push performed for this cutover.

- Local source review: grants, owner-qualified foreign key, backfill assertions,
  eligibility checks and compatibility paths included.
- PostgreSQL execution: pending; not yet validated against a live Supabase instance.
- Remote migration: pending user execution.
- Direct API/RLS and two-account UI tests: pending after application of scripts.

References: [Supabase event triggers](https://supabase.com/docs/guides/database/postgres/event-triggers),
[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

### Policy export reviewed after user execution

User supplied `Supabase Snippet Untitled query.csv` on October 2, 2026.
Its 11 rows match the expected phase-1 policies: owner-only private profiles and
photo collections, completed-member directory reads, and current-avatar Storage
access through `member_profiles`. No bucket-wide authenticated read policy appears
in this export. This confirms the expected policy definitions are present; it does
not independently verify RLS enablement, function modes/grants, trigger bindings,
backfill parity, or direct API enforcement. The CSV contains only the final policy
query's result, not the preceding verification result sets. Those checks remain
pending. No remote changes were performed during this review.


### Full preflight results reviewed before migration 003

User supplied all four result sets on October 2, 2026:

- Both Auth triggers and both legacy synchronization triggers are enabled (`O`)
  and bound to the expected functions/events.
- Signup inserts the private ID/email row; email updates synchronize from Auth.
  Both legacy synchronization functions match the phase-1 definitions. The directory
  function is SECURITY INVOKER (the default, so not printed in its definition).
- All 11 policies match the expected phase-1 rules. The two member SELECT policy
  names and conditions match exactly what migration 003 consolidates.
- `private_member_mismatch`, `missing_history_photo`, and `auth_profile_mismatch`
  each report **0** failures.
- `save_my_profile` is absent from the supplied function inventory, consistent with
  migration 003 not yet being applied.

This completes the supplied preflight review with no mismatch found. The next step
is migration 003, then its verification and the app deployment. Final destructive
cleanup remains deferred until the new app and signup flow are verified. These
results do not prove role grants, RLS flags, real API enforcement or execution of
the new save function; those remain covered by the verification and functional tests.


### Post-migration-003 verification reviewed

User supplied verification results on October 2, 2026:

- RLS is enabled on profiles, member_profiles and profile_photos.
- save_my_profile is SECURITY DEFINER with an empty search path; anon cannot
  execute it and authenticated can. Signup/email trigger functions retain the
  empty search path and neither API role can execute them directly.
- Identity/eligibility mismatch count is zero.
- The three legacy objects still exist and authenticated retains UPDATE on the
  four legacy profile fields. Both are expected during compatibility, before cleanup.
- sync_member_identity is absent, as expected before final cleanup installs it.

The separate scalar save-grants result was omitted, but the function inventory
provides the same anon/authenticated grant evidence. The table-level privileges
result was not supplied; capture it before final cleanup. These results do not
exercise the save body, Storage ownership validation, fresh OAuth signup or RLS
through actual API requests. Next: deploy the new app and perform functional checks.
Do not re-run migration 003 or run destructive cleanup based only on this checkpoint.
