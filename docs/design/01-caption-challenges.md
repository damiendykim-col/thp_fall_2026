# Stage 1 — Assignment 4: image uploads and caption challenges

Status: implemented; the project owner reports production validation and performance
satisfactory for the current scope. This status records user confirmation, not a new
independent deployment audit.
See [implementation and deployment notes](01-stage-1-setup.md) for defaults adopted and limitations.
Related: [stage index](README.md), [taste profiles](02-taste-profiles.md).

## Outcome

A signed-in user uploads or selects an image, writes a caption, generates an AI
opponent, and publishes a timeboxed challenge. Other users upvote their preferred
caption without knowing which is AI-generated. Attribution is revealed only when
the challenge closes.

This supplies the assignment's authenticated AI generation, persisted prompts and
outputs, vote inserts, RLS, and an intentional product experience.

## Agreed direction

- Challenges are separate from Members. Members remains member discovery.
- Users can submit an image specifically for content creation, separate from avatars.
- The challenge compares a human-written caption with an AI-generated caption.
- Upvotes only: one active vote per account per challenge.
- Users can undo an upvote or switch captions while the challenge is open.
- Human/AI attribution stays hidden until the timebox ends, including after voting.
- Keep the existing minimalist black/yellow design and Supabase authentication.

## Adopted defaults

- A fixed 24-hour duration, measured from publication.
- Hide live vote totals as well as attribution until closing.
- Creators cannot vote on their own challenges; they already know their own caption.
- Human caption is written before generation. The model sees the shared image and
  situation, not the human caption.
- One successful AI candidate per draft; retry failures within the configured limits.
  Creating a draft freezes the human caption and situation; successful outputs cannot
  be regenerated.
- New uploads support still JPEG, PNG and WebP, up to 3 MB and 40 megapixels.
  They are normalized to JPEG, at most 1600px per side. Existing templates, including
  GIFs, use the supplied scene description rather than frame analysis.
- Published pairs, their source image and deadline cannot be edited. Withdrawal can
  be designed separately; changing a joke must not change what existing votes mean.

## User flow and navigation

1. From Images or a Create action in Challenges, choose a template or upload an image.
2. Preview the image; enter a situation and a human caption.
3. Generate the opponent, with clear pending, failed and retry states.
4. Preview both captions and explicitly publish the pair.
5. Browse Open challenges, select one upvote, undo it, or switch choices.
6. Return to Finished challenges for attribution and results.

A challenge displays the image once, followed by equally styled caption choices.
Yellow indicates the viewer's selected upvote. Assign order randomly per viewer
and keep it stable when they return. Show both a closing time and a countdown.
Own drafts/published challenges appear in the “Yours” filter within Challenges.

The creator can know attribution in their own draft/management view. Do not imply
that their experience is blind. Other viewers must not receive origin metadata
before closing.

## Image lifecycle

Use a dedicated challenge-media bucket and records, not the avatar bucket/history.
Draft uploads are owner-only. Publishing makes the image accessible to the same
audience as its challenge. Personal uploads do not automatically become reusable
public templates.

Validate content type, file signature, size and dimensions server-side; use generated
object paths and do not trust the filename. Retain the normalized asset reference and record the model-input representation.
Original upload bytes are not retained. A published image must not be overwritten.

Uploaded images use their normalized bytes as model input. Templates use the
supplied scene description, with that limitation disclosed in the UI. Each generation
records its input representation; GIF animation is not analyzed.

Draft abandonment can leave uploads behind. Plan ownership-aware cleanup with a
retention window; never delete referenced published assets. Signed URL expiry is
part of the access model, not immediate revocation.

## Conceptual data model

- **Challenge images:** owner, storage reference or existing template reference,
  MIME type/dimensions and lifecycle metadata.
- **Challenges:** creator, source image, shared situation, publication/closing times
  and draft/generation/publication state. Withdrawal is deferred.
- **Caption candidates:** challenge and immutable text. Each published challenge
  has exactly one human and one AI candidate.
- **Private attribution:** candidate origin and generation linkage. Keep it outside
  the pre-close public read surface; RLS alone does not hide selected columns.
- **Generation requests:** owner, image/model-input reference, exact application-sent
  prompt messages, provider/model identifier, prompt version, status and result/error
  metadata. No credentials or inaccessible provider-internal reasoning.
- **Votes:** voter, challenge, selected candidate and timestamps. Enforce uniqueness
  on voter/challenge and that the candidate belongs to that same challenge.

These describe conceptual responsibilities. The implemented table and RPC contracts
are in [the challenge migration](../../supabase/migrations/202610050001_caption_challenges.sql).
Preserve final choices and generation versions for later stages without requiring
an analysis pipeline now.

## Mutations and access control

Generation runs on the server with a verified session and server-only provider key.
Users cannot insert arbitrary text and claim it is an authoritative model response.
Reserve a bounded per-user generation allowance and use request identifiers to
prevent double-clicks/retries from producing duplicate generations or charges.

Publishing validates ownership and both candidates atomically. The first upvote
inserts a vote row. Undo removes the active vote; switching atomically changes its
candidate. Use explicit desired-state mutations so a retried toggle cannot reverse
an already successful request. Optimistic UI must reconcile or roll back on failure.

The database enforces ownership, one active vote, candidate/challenge membership,
and the deadline for insert/update/delete. Deadline checks must use current database
time after any required lock wait, not a client countdown or stale transaction time.

Closed/open behavior is derived from publication and closing timestamps. A cron job
is not required for vote locking or reveal correctness. Once closed, ballots freeze.

Enable RLS on every exposed new table. Drafts, prompts and generation history are
owner-private; individual ballots are owner-readable. Other viewers receive only
permitted challenge content, their own choice, and post-close aggregates/attribution.
Do not expose attribution through joins, candidate identifiers, ordering conventions,
error messages, public caches, model metadata or pre-close count endpoints.

Published challenges and winners are available to signed-in users. Only signed-in
users can generate or vote. Challenges do not require completed profile names;
that requirement remains specific to the Members directory.

## Closing and results

At the deadline, further voting/undo/switching is rejected. Reveal Human/AI labels
and final vote totals. Distinguish human win, AI win, tie and no votes. Small samples
are descriptive community results, not scientific proof of superior humor.

Clients should refresh authoritative results at closing and when returning to a
backgrounded tab. A client timer cannot reveal attribution the server still withholds, and a slow
timer cannot authorize a late vote.

## Failure handling and testing

- Failed upload/generation leaves a recoverable draft and publishes nothing partial.
- Lost generation responses use request identity to recover status before retrying.
- Invalid model output is rejected rather than silently published.
- Concurrent votes, duplicate submissions and deadline-boundary operations preserve
  database constraints.
- Direct API tests prove no pre-close attribution/count leak and no cross-owner access.
- E2E: upload → human caption → generation → publish → second-account vote → undo →
  switch → close → reveal; creator restriction; draft privacy and failures.
- CI uses deterministic provider responses behind a local-test-only adapter. A
  separate live-provider smoke test checks the real integration. Neither replaces RLS.

## Audience and PM feedback

For Sam, scenarios such as dorm life, academic pressure and discovering NYC are
optional creation prompts, not imposed personality categories. The short competition
and later reveal supply a reason to create, judge and return.

In the Feedback Group, observe whether the image-to-publication flow is understood,
whether an upvote's meaning is clear, and whether users want to return for results.
Record PM feedback and reserve time for one focused revision before submission.

## Deferred and open decisions

Deferred: genre analysis, embeddings, Members graph, rankings, comments, personalized
recommendations, true A/B exposure experiments and automatic notifications.

Remaining decisions concern caption quality/persona tuning from PM feedback and
future moderation/reporting behavior. Provider, duration, upload limits, image
representation, regeneration rules, audience, and voting rules are implemented.
Unique closed winners now appear in Images; see [winner eligibility](../winners-gallery.md).
