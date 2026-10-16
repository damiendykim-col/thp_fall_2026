# Meme Club

A humor app built with Next.js, Supabase, and Google Gemini for Columbia's course project. Create a caption challenge, pit your own caption against AI, and let other members decide which is funnier—without revealing who wrote each caption until voting closes.

The app uses a minimal black theme with yellow accents and deploys to Vercel.

## What you can do

- **Challenges:** upload an image (including GIFs with reviewed frames) or choose a template, review its description, add optional joke context, write a caption, generate an AI opponent, and publish a 24-hour challenge. Each account gets one active upvote per challenge, with the ability to undo or switch it before closing. Creators cannot vote on their own challenges. Caption order varies by viewer; authorship and totals stay hidden until the deadline.
- **Guided creation:** choose and review an image, write your caption, then generate and publish from the private preview. [Creation flow](docs/challenge-creation.md).
- **Draft editing:** revise or cancel an unpublished challenge from its preview. Cancellation stops running generation claims and retains private audit history. Caption-only edits keep the AI opponent; changes to its image or scene require regeneration. [Revision rules and migration](docs/challenge-editing.md).
- **Home:** signed-out visitors can try a five-step practice round: choose an image, write a caption, meet a prepared opponent, try voting, and preview the reveal. Practice and Sign In share a switchable panel; switching preserves progress. Practice stays in browser memory, with no AI calls or recorded votes. Signed-in users browse Open / Results / Yours, resume their three most recent saved drafts, and revisit results. Creation and voting use compact image/caption workspaces with explicit next/previous round navigation. Voted rounds remain accessible, with a caught-up notice when appropriate. [Arrival and return visits](docs/arrival-and-return.md).
- **Results:** browse all finished rounds—including ties and rounds without votes—with both captions, attribution, totals, and paginated results. Templates live in challenge creation; the legacy gallery remains at `/images?view=templates`.
- **Account menu:** open Profile, sign out, or access Moderation if provisioned as a moderator.
- **Profile:** edit your name and favorite joke, upload a profile photo (including GIFs), or restore a previous photo. Text drafts survive navigation, and changed fields show unsaved edits.
- **Members (legacy route, outside primary navigation):** browse profile photos and favorite jokes without exposing members' names or email addresses. Your own card links to profile editing.

Templates are public. Real challenges, Results, and profile editing require sign-in. Members requires completed first and last names. Login currently also routes incomplete profiles through name onboarding, although challenge authorization itself only requires sign-in. Production sign-in uses Google OAuth.

## Content moderation

Challenge images and human/AI captions must pass safety checks before publication. Users can report challenges; creators and moderators can hide them. Moderator setup and template visual approval are documented in the [moderation guide](docs/moderation.md). Human captions are checked in a separate Gemini request and remain excluded from opponent generation.

## Run locally without external credentials

Use **Node.js 22** and **Docker**. Start Docker, then run:

```sh
npm ci
npm run e2e:setup
npm run e2e:account
npm run e2e:dev
```

Open [127.0.0.1:3100/login](http://127.0.0.1:3100/login) and sign in with the local-only credentials printed by `e2e:account`.

This workflow starts an isolated Supabase instance, applies the schema, seeds gallery templates, and uses deterministic mock AI captions. It needs no Google OAuth client or Gemini API key and does not use the hosted course database. Auth sessions, database triggers, RLS, and Storage are real.

The local sign-in flag only works in development against loopback Supabase, outside Vercel. It replaces the Google sign-in step for testing; it does not bypass authorization.

- `npm run e2e:stop` stops the containers and retains local data.
- `npm run e2e:reset` **erases the isolated local database** and rebuilds it.

See [local development and E2E testing](docs/e2e.md) for ports, isolation, troubleshooting, and test-account behavior.

## Tests and checks

```sh
npm run lint
npm test -- --runInBand
npm run build
```

For browser tests, install Chromium once, start the local stack, and run Playwright:

```sh
npx playwright install chromium
npm run e2e:setup
npm run test:e2e
```

Stop `e2e:dev` first: Playwright starts its own server on port 3100 and deliberately refuses to reuse an existing one. `npm run test:e2e:ui` opens the interactive runner.

Jest covers application logic and components. Playwright exercises real local Auth, database, and Storage flows, including profile privacy, photo history, challenge generation, reversible voting, timed reveals, and winner eligibility. GitHub Actions runs the unit and E2E suites on pull requests and pushes to `main`.

Mock generation does not verify live Gemini availability or quality. Google OAuth also needs a manual deployment smoke test.

## Architecture and access control

- **Next.js App Router and TypeScript:** pages, server actions, and server-side provider calls.
- **Supabase Auth, Postgres, and Storage:** Google sessions, persistent content, and uploaded media.
- **Google Gemini:** caption generation on the server. Generation attempts record their prompts, model, settings, and image reference.
- **Vercel:** hosting and Speed Insights.

Uploaded images have reusable, owner-private description records; each challenge preserves its confirmed description and optional joke context separately. See [reviewed image descriptions](docs/image-descriptions.md) for provenance and deployment.

Private identity lives in `profiles`; member-facing content lives in `member_profiles`, with photo history in `profile_photos`. Challenge records, captions, votes, and generation attempts are stored separately. Winners are derived from closed results rather than copied into another gallery table.

RLS and database functions enforce ownership, voting limits, deadlines, and visibility. Raw challenge captions intentionally have no direct client access: scoped RPCs return the fields a viewer may see, keeping AI attribution and vote totals hidden during an open challenge. Server admin credentials are reserved for privileged upload, moderation, draft-revision and generation operations after server-side authorization.

New challenge uploads accept JPEG, PNG, WebP and GIF images up to 3 MiB (shown as 3 MB). Still images are normalized; GIFs retain animation and use confirmed sampled frames for AI input, with full-animation moderator approval before publication. Uploaded image representations are sent to the model; gallery templates, including GIFs, use the confirmed image description and optional context instead of frame analysis. See [Stage 1 setup and limits](docs/design/01-stage-1-setup.md) for generation quotas and operational details.

## Hosted setup and deployment

The local workflow above is the quickest way to explore the app. To use a hosted Supabase project and real Gemini generation:

1. Follow the [deployment guide](docs/deployment.md). Fresh databases use the complete canonical migration sequence; existing databases need only verified pending migrations. Historical profile cleanup is already incorporated and must not be replayed. A Vercel deployment does **not** apply SQL.
2. Configure the deployment environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: browser-safe Supabase connection settings.
   - `SUPABASE_SECRET_KEY` **or** `SUPABASE_SERVICE_ROLE_KEY`: server-only administrative access.
   - `GEMINI_API_KEY`: server-only Gemini credentials.
   - Optional `GEMINI_MODEL` and `LLM_PROVIDER`: provider configuration documented in the Stage 1 guide.
3. Enable Google in Supabase with your Google OAuth client. Google's authorized redirect points to Supabase's `/auth/v1/callback`; Supabase's redirect allowlist must include your app's exact `/auth/callback` URL for each origin you use.
4. Deploy through the connected GitHub/Vercel project. Set environment variables for the relevant Preview and Production environments, then verify sign-in, profile editing, generation, publication, and voting with separate accounts.

Never prefix Gemini or Supabase administrative keys with `NEXT_PUBLIC_`, commit them, or expose them to the browser. Keep `E2E_AUTH_ENABLED` disabled in hosted environments.

For ordinary development against a configured backend, `.env.example` lists the settings: copy it to the Git-ignored `.env.local`, supply the required values, and use `npm run dev` on port 3000. Prefer the isolated workflow for tests that create accounts or uploads.

## Further reading

- [Current plan](docs/design/README.md): completed UX work, release checks, instructor-gated taste work and deferred ideas.
- [Temporal context](docs/design/04-temporal-context.md): future dated context and external provider integration; not implemented.
- [E2E guide](docs/e2e.md): local setup, test login, browser coverage, and CI.
- [Profile schema rollout](docs/profile-schema-rollout.md): identity separation and migration verification.
- [Stage 1 setup](docs/design/01-stage-1-setup.md): AI configuration, storage, quotas, and current limits.
- [Winner RPC](docs/winners-gallery.md): retained compatibility contract; the old winner-only UI is retired.
- [Documentation map](docs/README.md): current guides and historical records.
- [Performance notes](docs/performance.md): caching, request timing, and instrumentation.

GIF behavior and limits are documented in the [GIF guide](docs/gif-challenges.md); its schema is part of the canonical migration sequence.
