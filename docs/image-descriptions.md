# Reviewed image descriptions

Status: implemented; hosted schema verified during
[database maintenance](database-maintenance-2026-10-10.md). Migration instructions
below are for new environments, not a request to replay applied SQL. Evaluate live
Gemini description quality separately from schema and mock-provider checks.

## Creation flow

1. Selecting an upload sends its normalized image to Gemini for a short, literal
   visual description. The disclosure appears before the file picker.
2. The owner sees the image and editable suggestion. They can accept it, edit it,
   or choose **Write my own description**. Confirmation is always explicit;
   editing the description or changing the image clears confirmation.
3. **Add context for the joke** is optional and separate from visual description.
4. Creating the draft freezes the confirmed description, context, and human caption.
   Both caption candidates use that shared context; the human answer is never sent
   to the caption generator.

Templates start with their existing description, which must also be reviewed.
No description-model call is made for templates; their frames are not analyzed.
Existing challenges keep their original situation and do not require a backfill.

A failed description request leaves the upload available for manual description.
Only images that have passed safety checking can use manual description fallback.
See [moderation setup](moderation.md) for its additional migration.
An interrupted request can be recovered with **Retry this image** (or by reselecting
the same file after leaving the page). If analysis
is still marked running, allow two minutes before recovering it for manual review.
There is no automatic paid retry of failed description generation.

## Data and provenance

`challenge_images` holds the owner, immutable normalized Storage path, content hash,
original AI suggestion, analysis status, provider/model, exact prompt/version, and
latest confirmed description and its source. Source is accepted, edited, replaced,
or manual (no AI suggestion). Client submissions cannot supply the original AI text
or provider metadata.

`challenges.image_id` references an uploaded image. Each challenge snapshots its
`image_description`, `joke_context`, and `description_source`; later reuse of the
same image does not rewrite earlier challenges. Template reviews use source `template`
and do not change the public template library. The existing `situation` field is
retained for feed compatibility: optional context if supplied, otherwise description.

Owner-scoped hashes of normalized image bytes deduplicate upload/analysis retries.
The same image can be used in multiple challenges without generating another
suggestion. A per-form submission ID makes repeated draft submissions idempotent.

A literal image description, user-written scenario, and inferred humor style are
separate signals. Future taste analysis can consume the confirmed snapshot and
its provenance without treating user approval as proof of visual accuracy.

## Access and limits

- `challenge_images` has RLS and owner-only SELECT. Browser roles cannot write it.
- New reservation/review RPCs are service-only. Server actions verify the session,
  and the review RPC checks image ownership and explicit confirmation.
- Other challenge viewers receive the confirmed description through the existing
  challenge reader, never the original analysis prompt or private image history.
- At most 10 new image reservations per owner per rolling day, enforced under a
  database lock before upload/provider work. One analysis claim per image prevents
  concurrent duplicate generation. Existing caption-generation quotas are separate.
- Abandoned reservations/uploads remain private. Automatic retention cleanup remains
  deferred; do not delete images referenced by challenges.

## Deployment

1. Run [202610080001_image_descriptions.sql](../supabase/migrations/202610080001_image_descriptions.sql)
   once in the hosted SQL editor, after the challenge/winner migrations.
2. Deploy the app. Existing Gemini and server-only Supabase credentials are reused;
   no new provider key is needed. With moderation enabled, the new challenge page allows 120 seconds for actions.
3. Upload a non-sensitive image, inspect the real description, edit/confirm it, add
   optional context, and generate a caption. Verify description quality and that
   the human caption remains absent from the stored generation prompt.

Local setup applies this migration through `npm run e2e:setup`. Unit tests cover
exclusive analysis claims, and stale UI responses. E2E covers review provenance,
image reuse, prompt separation, quotas, idempotency, and the existing blind-voting flow.
