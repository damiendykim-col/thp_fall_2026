# Meme Club

A Next.js image gallery for Assignment #2. Both `/` and `/images` render rows from the Supabase `images` table. The gallery supports newest/oldest sorting, an expanded image viewer (Escape to close, arrow keys to navigate), and optional descriptions.

## Local development

1. Run `npm install`.
2. Copy `.env.example` to `.env.local` and supply your Supabase project URL and publishable key.
3. Run `npm run dev` and open http://localhost:3000/images.

`.env.local` is ignored by Git. The publishable key is the modern equivalent of Supabase's legacy anon key. Never use a secret or service-role key for these variables.

## Supabase data

The `public.images` table has four columns:

- `id`: UUID primary key, default `gen_random_uuid()`.
- `image_url`: Text containing a direct, public image URL.
- `description`: Optional text; empty values are supported.
- `created_at`: Timestamp with time zone, default `now()`.

The project uses RLS with a SELECT policy for `anon` and `authenticated`, plus SELECT table privileges for those roles. Add records in the Supabase dashboard. Image files belong in a public Storage bucket; use `/storage/v1/object/public/...` URLs rather than dashboard previews or expiring signed links.

The server queries Supabase on each page request, so newly added records appear on refresh without redeployment. Fetching uses the publishable key and respects RLS. Google sign-in, private profiles, and profile photo uploads are supported. Voting and gallery uploads are outside this version's scope.

## Checks

- `npm run lint`
- `npm test -- --runInBand`
- `npm run build`
- `npm run test:e2e` (after local Supabase setup; see below)

## Vercel

Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the Vercel project's environment variables for the environments you deploy to. Commit and push the code to the connected GitHub repository, then deploy/redeploy. Verify `/images` on the deployment displays the records and opens images correctly.

## Assignment 3

See [the setup guide](docs/assignment-3-setup.md) for the SQL migration, Google OAuth client configuration, exact callback URLs, and end-to-end verification. `/profile` requires sign-in; `/members` also requires both profile names. The gallery remains public.


## End-to-end tests and local test login

See [the E2E guide](docs/e2e.md) for isolated Supabase setup, Playwright, and CI.
With Docker running, use `npm run e2e:setup` then `npm run test:e2e`.
For manual testing without Google, run `npm run e2e:account` and `npm run e2e:dev`.
The server-only `E2E_AUTH_ENABLED` flag works only in development with local
Supabase; it is rejected in production and never bypasses session or RLS checks.

## Caption challenges (Assignment 4)

See [Stage 1 setup](docs/design/01-stage-1-setup.md) for the hosted SQL migration,
server-only Gemini configuration, test workflow and current limits.
