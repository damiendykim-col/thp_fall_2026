# Challenge moderation

Status: implemented and tested locally. Hosted migration, moderator provisioning,
template review, and a live Gemini smoke test remain deployment steps.
This is a small challenge moderation workflow, not a guarantee that all harmful
content will be detected or that a moderator is continuously monitoring reports.

## Policy and user experience

`moderation-v1` permits dark humor, satire, profanity, fictional absurdity, and
non-graphic adult jokes by themselves. It blocks protected-group hate, targeted
harassment, threats/encouragement of violence or graphic gore, explicit or exploitative
sexual content (including sexual content involving minors), encouragement/instructions
for self-harm, and exposed private information/nonconsensual intimate content.

- New uploads are checked before Storage upload and description generation. A blocked
  image cannot proceed through the manual-description fallback.
- Confirmed descriptions, joke context, and human captions are checked before draft
  creation. A rejected form remains editable.
- AI captions are checked before being saved as the opponent. Blocked output fails
  that generation attempt; existing generation retry limits still apply.
- Publication checks canonical stored content and requires current-policy approvals
  in SQL. Calling the publish RPC directly cannot bypass this gate.
- Provider errors, invalid/unfinished responses, quota exhaustion, and interrupted
  checks do not approve content. Users can retry; rejected text/images must be revised
  or replaced. Frozen drafts link to creating a revised challenge.

Human captions are sent to Gemini in a separate safety-classification request. They
are **not** sent to the opponent-caption generator. Moderation does not change the
blind vote/reveal rules. Safety categories are not taste or personality features.

Gallery templates (including GIFs) require a moderator's visual approval before use
in new challenges. Their descriptions do not establish visual safety. Review records
bind to the template URL; changes to image contents at the same URL must be followed
by revoking its review, or preferably using a new immutable URL. Do not approve an
external URL whose contents you do not control or trust.

## Reports and hiding

Signed-in viewers can submit one report per challenge, up to ten new reports per
rolling day. Reports contain a category, not public accusations or reporter details.
Reporting does not automatically hide content. Moderators see up to 100 oldest
unresolved reports at `/moderation`, can follow the challenge link, dismiss a report,
or hide the challenge. The same page lists up to 50 templates awaiting visual review.

Creators can hide their own published challenges through **Manage visibility**.
Hiding is idempotent and resolves outstanding reports. There is no restore button in
this version. Hidden challenges are excluded from other users' direct reads, feeds,
voting, publication, Winners, and newly issued private Storage links. The creator
retains access to their own content. Previously issued signed URLs may remain usable
for their existing lifetime (currently up to one hour); hiding is not immediate
revocation of bytes already delivered to browsers.

## Data and access boundaries

- `moderation_checks`: private owner-scoped phase, input fingerprint, provider/model,
  policy version, status/category, attempts, and timestamps. No raw provider responses,
  chain of thought, or submitted-content copies are logged here. The versioned policy
  text is kept in source control.
- `moderators`: provisioned through trusted database administration only. Clients
  cannot self-assign roles; every privileged RPC checks membership independently.
- `challenge_reports`: reporters can read their own rows; the queue is accessed through
  a moderator-only function and does not expose reporter identity to other users.
- `challenge_template_reviews`: trusted visual approvals for specific template URLs.
- Challenges reference approved image/human/AI checks. These references are not writable
  by browser roles. Hidden timestamps and actor IDs provide a minimal removal record.

All new tables have RLS. The role and template-review tables deliberately grant no
client table access; scoped RPCs manage access. Security-definer functions use an
empty search path and explicit grants/authorization. A service key is required for
provider checks and authoritative writes, as with existing generation.

Checks are deduplicated by owner, phase, content fingerprint, and policy version.
Concurrent callers cannot start duplicate checks. Interrupted claims can retry after
two minutes; each input allows at most three attempts. A rolling-day quota permits
up to 40 counted attempts per owner. Retrying an older failed check conservatively
counts its previous attempts too. User-visible limits may therefore be reached before
40 new provider calls. Policy changes must update both application and SQL versions.

## Scope and limitations

This covers challenge content. It does **not** retrofit moderation onto avatars,
favorite jokes, or the public Templates gallery. Previously published challenges are
not silently marked approved or automatically removed; moderators should review
existing content and use reports/hiding where needed. New publication is gated.

This implementation uses Gemini for classification and leaves provider safety settings
at their defaults. It is fallible: evaluate harmless satire, ambiguous cases, and known
policy examples before relying on it broadly. A full appeal/restore process, moderator
notifications, automated backlog processing, and retention/deletion workflows are deferred.
Template rejection/removal from the public gallery remains an operator task.

## Deployment

1. Apply [202610080001_image_descriptions.sql](../supabase/migrations/202610080001_image_descriptions.sql)
   if it is not already applied, then
   [202610080002_challenge_moderation.sql](../supabase/migrations/202610080002_challenge_moderation.sql),
   followed by [202610080003_fix_generation_quota.sql](../supabase/migrations/202610080003_fix_generation_quota.sql).
   The correction is required even if moderation is already deployed: it repairs
   a generation quota query that referenced the wrong timestamp column.
2. In the Supabase SQL editor, grant your existing account moderator membership using
   its UUID from Auth → Users (never a browser-provided role or user metadata):

   ```sql
   insert into public.moderators (user_id)
   values ('REPLACE_WITH_YOUR_AUTH_USER_UUID'::uuid)
   on conflict do nothing;
   ```

3. Deploy with the existing server-only Gemini and Supabase credentials. New-challenge
   and challenge-detail routes allow 120 seconds for the composed checks/generation;
   individual moderation calls time out after 15 seconds.
4. Sign in as that account and open `/moderation`. Visually review the curated template
   images/animations and approve the appropriate ones. Unreviewed templates cannot be
   used to create/publish challenges. No production templates are auto-approved.
5. Smoke-test a harmless upload, editable text rejection/recovery, generation, publishing,
   a report from another account, and hide/dismiss permissions. Verify live model quality
   and quota behavior; local tests use deterministic responses, not real moderation quality.

Tests explicitly seed approvals for curated **local** templates and constructed test
challenges. Mock markers only work behind the existing isolated development guard;
they are not a production keyword filter or moderation bypass.

References: [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)
and [provider safety settings](https://ai.google.dev/gemini-api/docs/safety-settings).
