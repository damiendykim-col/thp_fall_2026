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

The server queries Supabase on each page request, so newly added records appear on refresh without redeployment. Fetching uses the publishable key and respects RLS. Login, uploads, and voting are outside this version's scope.

## Checks

- `npm run lint`
- `npm test -- --runInBand`
- `npm run build`

## Vercel

Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the Vercel project's environment variables for the environments you deploy to. Commit and push the code to the connected GitHub repository, then deploy/redeploy. Verify `/images` on the deployment displays the records and opens images correctly.
