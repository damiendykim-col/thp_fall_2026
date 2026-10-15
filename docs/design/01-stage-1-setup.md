# Stage 1 implementation and deployment

Current reference: October 15, 2026. Earlier production validation was reported by
the project owner; it does not verify later releases. Use the centralized
[deployment guide](../deployment.md) for migration and release procedure.

Implemented: authenticated Challenges, upload/template drafts, server-side Gemini
caption generation, explicit publication, one reversible upvote per voter/challenge,
24-hour deadline, and server-enforced attribution/results reveal. Members stays separate.

Image-description review, moderation and GIF schema are now applied on hosted
Supabase. See [maintenance](../database-maintenance-2026-10-10.md) for verification
and history reconciliation. Live model quality still requires deployment testing.

## Provider configuration

`GEMINI_MODEL` defaults to `gemini-3.5-flash-lite`; `LLM_PROVIDER` defaults to Gemini.
`GEMINI_API_KEY` and `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` are server-only.
Confirm availability in the target deployment; AI Studio's UI default does not
choose the app's model. Taste experiment models are configured separately.
See [deployment](../deployment.md) for the complete environment/OAuth checklist.

## Local testing

`npm run e2e:setup`, then `npm run test:e2e`. Setup starts the isolated stack and
applies pending local migrations, including when the stack is already running.
Use `npm run e2e:dev` for manual inspection with `npm run e2e:account` credentials.

The runner uses only the isolated loopback database, injects its local service key,
blanks production secrets and enables a deterministic mock. The mock requires
local test auth, development mode and no Vercel environment. It cannot be enabled
on production just by setting `LLM_PROVIDER=mock`.

## Operational choices

- Signed-in readers only. Challenge authorization does not require names, but the
  login flow still sends incomplete profiles through name onboarding.
- New JPEG/PNG/WebP uploads: 3 MB maximum, 40 megapixels maximum. GIF uploads also support reviewed frames; see [GIF rollout](../gif-challenges.md) for limits and the required migration.
  Server decodes, rotates, resizes to fit 1600px, strips metadata and stores JPEG.
  A 4 MiB Server Action allowance accommodates multipart overhead. Originals are not retained.
- Gallery templates, including GIFs, use the supplied situation/scene description
  as model input (now a confirmed visual description plus optional joke context). The UI discloses that frames are not analyzed. Uploaded images
  use normalized image bytes (confirmed sampled frames for GIFs) alongside the
  confirmed description and optional context.
- Draft creation snapshots the human caption, confirmed description and context.
  [Unpublished editing](../challenge-editing.md) selectively invalidates the AI result.
  Three generation attempts per challenge, ten attempts and ten drafts per user/day;
  revision does not reset these quotas.
  If a request is interrupted, it can be reclaimed after two minutes.
- Exact system/user prompt text, image reference/representation, generation settings,
  provider/model and prompt version are stored with each attempt. No key or internal
  model reasoning is stored. Private normalized bytes remain in Storage.
- Publication starts 24 hours. Published pairs cannot be edited; creators cannot vote.
  Counts and origin are withheld by the read RPC until the database deadline.
- Votes are explicit desired state (caption ID or null for undo). SQL locks the
  challenge and uses the current clock after acquiring that lock.
- Caption base table has no client read grant. All new tables have RLS; mutating
  clients use narrow RPCs. Service-only generation functions are not public RPCs.
- Image signed URLs last one hour. Reusable saved uploads remain available after
  a draft-write failure. Automated abandoned-upload/draft retention is deferred;
  never delete an image still referenced by a challenge.
- Open/Yours are bounded to 50 rows; Results uses 12-row offset pages. Further
  pagination work is conditional on usage, not a prerequisite for this release.
- Existing provider safety defaults remain enabled and the prompt has content
  constraints. The [moderation extension](../moderation.md) provides pre-publication checks and reporting. Its hosted schema is verified;
  follow the guide when provisioning a new environment.

Gemini API contract: https://ai.google.dev/api/generate-content
Image inputs: https://ai.google.dev/gemini-api/docs/image-understanding
