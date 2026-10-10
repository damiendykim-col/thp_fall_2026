# Stage 1 implementation and deployment

Current status: the project owner reports production validation and performance
satisfactory. Deployment steps below are reference instructions for future setups,
not a request to replay already-applied migrations.

Implemented: authenticated Challenges, upload/template drafts, server-side Gemini
caption generation, explicit publication, one reversible upvote per voter/challenge,
24-hour deadline, and server-enforced attribution/results reveal. Members stays separate.

The subsequent [image-description review step](../image-descriptions.md) has its own
additive migration and deployment instructions. The production sign-off above
precedes that addition.

## Deploy in this order

1. Run `supabase/migrations/202610050001_caption_challenges.sql` once in the hosted
   project's SQL editor, after the already-completed profile cutover. This creates
   four tables, functions and a private `challenge-images` bucket. It does not
   replace profile tables or avatar policies. Local migration has been applied only
   to the isolated E2E stack; no hosted database was changed by this work.
2. In Vercel, retain `GEMINI_API_KEY` (already configured by the project owner).
   `GEMINI_MODEL` defaults to `gemini-3.5-flash-lite`; override it if the project
   does not have access to that model. `LLM_PROVIDER` defaults to Gemini.
3. The server also needs `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` for
   normalized uploads and authoritative AI-result writes. The existing Supabase
   integration previously showed both names. Check presence in the deployment
   environment; do not expose values or add NEXT_PUBLIC prefixes.
4. Commit/push and redeploy using the existing workflow. Ensure variables apply to
   the environment being tested (Preview and/or Production). No secrets need to
   be copied into the local workspace.
5. Live smoke test: sign in, create a draft using a non-sensitive image, generate,
   inspect the preview, then publish. Confirm another account can vote but cannot
   see attribution. Real Gemini model availability, quota and caption quality
   must be checked on the deployment; local mock tests cannot establish them.

## Local testing

`npm run e2e:setup`, then `npm run test:e2e`. Setup starts the isolated stack and
applies pending local migrations, including when the stack is already running.
Use `npm run e2e:dev` for manual inspection with `npm run e2e:account` credentials.

The runner uses only the isolated loopback database, injects its local service key,
blanks production secrets and enables a deterministic mock. The mock requires
local test auth, development mode and no Vercel environment. It cannot be enabled
on production just by setting `LLM_PROVIDER=mock`.

## Operational choices

- Signed-in readers only, no completed-name requirement for Challenges.
- New JPEG/PNG/WebP uploads: 3 MB maximum, 40 megapixels maximum. GIF uploads also support reviewed frames; see [GIF rollout](../gif-challenges.md) for limits and the required migration.
  Server decodes, rotates, resizes to fit 1600px, strips metadata and stores JPEG.
  This fits the existing 3 MB Server Action limit. Originals are not retained.
- Gallery templates, including GIFs, use the supplied situation/scene description
  as model input (now a confirmed visual description plus optional joke context). The UI discloses that frames are not analyzed. Uploaded images
  use actual normalized image bytes, not generated descriptions.
- Draft creation freezes the human caption, confirmed image description, and optional joke context. One successful AI result
  per draft, three attempts per draft, ten attempts and ten drafts per user/day.
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
- Image signed URLs last one hour. Failed draft writes attempt to remove their
  upload. Automatic abandoned-draft/orphan retention cleanup is deferred; do not
  delete a referenced published image during manual storage maintenance.
- Feed shows the latest 50 per filter; cursor pagination is deferred.
- Existing provider safety defaults remain enabled and the prompt has content
  constraints. The [moderation extension](../moderation.md) adds pre-publication checks and reporting; apply its migration before deploying that code.

Gemini API contract: https://ai.google.dev/api/generate-content
Image inputs: https://ai.google.dev/gemini-api/docs/image-understanding
