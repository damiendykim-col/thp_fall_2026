# Editing unpublished challenges

Release 2, October 14, 2026. Local implementation; apply the migration before deploying.

Creators can open **Edit challenge** from an unpublished preview. The form starts
with its saved image/template, reviewed description, context and human caption.
**Save changes** keeps the same challenge URL. **Discard edits** returns to the
preview without changing the saved challenge. Unsaved edits survive refresh in the
same tab, separately from new-challenge work and other challenge revisions.

## Revision rules

- Caption-only changes keep the AI opponent, which never receives the human caption.
  Human-caption safety approval is cleared and must be re-established before publication.
- Image, confirmed description, or context changes remove the AI caption, clear
  affected approvals, and return the challenge to draft. Generation is an explicit
  action; saving does not call the opponent generator.
- Uploaded image representations remain immutable. Replacing a GIF or its sampled
  frames creates/reuses a separate owned upload reference. Full-GIF moderator
  approval belongs to that reference, not to the challenge.
- Published, previously published (`published_at` present), hidden, voted-on, and
  actively generating challenges cannot be edited by the revision RPC. The edit
  page also requires authentication and ownership.
- A revision number rejects older-tab saves. Moderation writes and generation
  claims bind to the revision they inspected, preventing stale approvals/prompts.
- Generation history is preserved. Edits do **not** reset the existing three-attempt
  per-challenge or ten-generation daily limits. A challenge at its generation cap
  still cannot generate another opponent after a scene change.
- A no-op save preserves the revision, AI caption and approvals. Blocked submitted
  content is not saved; provider failures leave the existing draft intact.

The database holds the row lock only for validation/mutation, never while awaiting
Gemini. The service-only revision RPC repeats ownership, state and asset checks.
Browser roles retain their existing read permissions and cannot call the new
mutation or generation-claim wrapper directly.

## Migration and rollout

Canonical migration:
`supabase/migrations/20261015003108_editable_challenge_drafts.sql`

It adds `challenges.revision` (existing rows start at zero) and two service-only
functions: `revise_caption_challenge` and `claim_reviewed_caption_generation`.
It does not rewrite existing content, delete votes, or reset generation history.
The existing service-only claim function remains available for trusted callers.
New application code uses the revision-aware wrapper. Any other application that
reads content and later writes approvals or claims generation must likewise bind
that operation to the inspected revision.

1. Apply this migration once to the shared Supabase database before deploying this
   app revision. Keep migration ownership in this repository; the admin app must
   not maintain a competing schema history.
2. Deploy the app. Verify a caption-only edit, a scene/image change requiring a new
   opponent, and a stale-tab rejection on a non-sensitive unpublished challenge.
3. Verify published rounds still offer no edit action and retain their votes.

Only the isolated local E2E database has been migrated during this implementation.
No hosted schema or production content was changed. Rolling back app code is
compatible with the additive schema, but older writers lack revision-aware checks;
do not run older writers concurrently with draft editing.

## Regression coverage

- Component tests: edit-link eligibility, populated form recovery separated by
  account/challenge/revision, late moderation results rejected.
- Database integration tests: client and other-owner denial, selective invalidation,
  stale-save rejection, preserved generation history, atomic edit/generation race,
  published-vote preservation.
- Browser tests: rejected caption recovery, saved-edit navigation, caption-only
  edits retaining the opponent, scene/image changes requiring regeneration,
  reload recovery, and published edit-route rejection.
