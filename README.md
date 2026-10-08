# Meme Club

A humor app built with Next.js, Supabase, and Google Gemini for Columbia's course project. Create a caption challenge, pit your own caption against AI, and let other members decide which is funnier—without revealing who wrote each caption until voting closes.

The app uses a minimal black theme with yellow accents and deploys to Vercel.

## What you can do

- **Challenges:** upload an image or choose a template, review its description, add optional joke context, write a caption, generate an AI opponent, and publish a 24-hour challenge. Each account gets one active upvote per challenge, with the ability to undo or switch it before closing. Creators cannot vote on their own challenges. Caption order varies by viewer; authorship and totals stay hidden until the deadline.
- **Images:** browse completed challenge winners with Human-written or AI-generated caption labels. Ties and rounds without votes do not produce winners. The separate Templates view retains cards, list, table, sorting, and an expanded image viewer.
- **Profile:** edit your name and favorite joke, upload a profile photo (including GIFs), or restore a previous photo. Text drafts survive navigation, and changed fields show unsaved edits.
- **Members:** browse profile photos and favorite jokes without exposing members' names or email addresses. Your own card links to profile editing.

Templates are public. Challenges, winners, and profile editing require sign-in. The Members page also requires a completed first and last name. Production sign-in uses Google OAuth.

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

RLS and database functions enforce ownership, voting limits, deadlines, and visibility. Raw challenge captions intentionally have no direct client access: scoped RPCs return the fields a viewer may see, keeping AI attribution and vote totals hidden during an open challenge. Server admin credentials are reserved for privileged upload and generation operations.

New challenge uploads accept still JPEG, PNG, and WebP images up to 2 MB and are normalized before storage. Uploaded images are sent to the model; gallery templates, including GIFs, use the confirmed image description and optional context instead of frame analysis. See [Stage 1 setup and limits](docs/design/01-stage-1-setup.md) for generation quotas and operational details.

## Hosted setup and deployment

The local workflow above is the quickest way to explore the app. To use a hosted Supabase project and real Gemini generation:

1. Follow the [Auth and profile setup](docs/assignment-3-setup.md), [profile schema rollout](docs/profile-schema-rollout.md), [caption challenge setup](docs/design/01-stage-1-setup.md), [winners migration](docs/winners-gallery.md), and [image-description migration](docs/image-descriptions.md), in that order. For an existing database, check which migrations and manual cutover steps are already applied before running SQL. A Vercel deployment does **not** apply database migrations.
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

- [Design stages](docs/design/README.md): challenge design and future taste profiles / interactive Members graph. Those later stages are planned, not implemented.
- [E2E guide](docs/e2e.md): local setup, test login, browser coverage, and CI.
- [Profile schema rollout](docs/profile-schema-rollout.md): identity separation and migration verification.
- [Stage 1 setup](docs/design/01-stage-1-setup.md): AI configuration, storage, quotas, and current limits.
- [Winners gallery](docs/winners-gallery.md): eligibility, visibility, and deployment.
- [Performance notes](docs/performance.md): caching, request timing, and instrumentation.
