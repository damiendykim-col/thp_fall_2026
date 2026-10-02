# Profile schema and RLS rollout

Prepared October 2, 2026. Status: scripts prepared locally; NOT applied to Supabase.

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

## Phase 1: safe with the current app

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

The current application still reads/writes `profiles.avatar_path`,
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

## Phase 2: required app cutover (not included or ready to run)

- [ ] Update profile reads to join own `profiles`, `member_profiles`, `profile_photos`.
- [ ] Update photo selection to authorize against the collection, not legacy history.
- [ ] Implement one transactional save for names, joke and selected current photo;
      enforce authenticated ownership inside the database. Avoid partially saved
      multi-request updates. Keep eligibility server-derived when names change.
- [ ] Change the trigger direction/source of truth in a coordinated migration;
      do not install two opposing synchronization triggers.
- [ ] Preserve draft field/photo-path compatibility; verify save/discard/reload.
- [ ] Retire old application deployments before removing compatibility columns.
- [ ] Only then prepare a separate cleanup migration for old columns/history/RPC.

No destructive cleanup script is supplied intentionally: its safe contents depend
on the final app write path. Do not drop legacy objects based solely on this plan.

## Recovery

Before commit, transaction failure rolls back that script. After phase 1 commits,
the unchanged app remains compatible; no app rollback is required. If directory
access regresses, keep both new tables/data and restore the previous directory
function and known Storage policy definitions from the backup (or reviewed October
1 migration definitions). Reverting to SECURITY DEFINER restores its advisor warning.
Do not delete photos or disable RLS as a recovery step. Do not drop the compatibility
triggers while leaving clients writing legacy columns and expecting new-table reads.

## Validation record

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
