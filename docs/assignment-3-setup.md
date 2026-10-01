# Assignment 3 setup

## 1. Apply the database migration

Open your existing Supabase project's SQL Editor and run the entire contents of
these files in order, once each:
1. `supabase/migrations/202610010001_profiles.sql`
2. `supabase/migrations/202610010002_profile_email.sql`
3. `supabase/migrations/202610010003_avatar_gifs.sql`

Run only migrations you have not already applied. Each file is one
transaction; if it fails, none of that file's changes are committed. Do not rerun
a migration after success.

It creates:
- `public.profiles`, keyed to `auth.users.id`, with required `email` and nullable `first_name`, `last_name`, and `avatar_path`.
- An AFTER INSERT trigger on `auth.users` that inserts a profile. Existing auth users are backfilled too.
- Policies allowing authenticated users to read and update only their own profile. Users cannot change profile IDs or insert profiles through the API.
- A private `avatars` bucket. Each user can upload/read/delete files only inside their own UUID folder. JPEG, PNG, WebP, and GIF are allowed, up to 2 MB.

Email is copied from `auth.users.email` and synchronized when that Auth field changes. Clients cannot edit profile emails directly. The email migration stops with a clear error if any existing account has a null or blank email; resolve that in Supabase Auth before retrying. Email-less sign-ins are intentionally incompatible with this schema.

The trigger deliberately leaves names null so new users are prompted to enter them. It runs at account creation, not on every login; repeat logins preserve the user's edits.

## 2. Create your own Google OAuth client

In Google Cloud / Google Auth Platform:
1. Select or create your own project.
2. Configure Branding and Audience for the app. If the audience is External and the app is in Testing, add the Google accounts that will test it (including the grader if needed).
3. Configure the basic OpenID, email, and profile scopes.
4. Create an OAuth client with application type **Web application**.
5. Add your app origin under Authorized JavaScript origins (your Vercel production origin, and `http://localhost:3000` for local testing).
6. Set the **Google Authorized redirect URI** to:
   `https://uiakihcaipqkqbvvnsub.supabase.co/auth/v1/callback`
7. Put the Client ID and Client Secret into Supabase → Authentication → Sign In / Providers → Google, and enable the provider. Do not put the Google secret in the repository or a NEXT_PUBLIC variable.

Google returns to Supabase, then Supabase returns to the application. These are different callbacks.

## 3. Configure Supabase redirect URLs

Under Authentication → URL Configuration:
- Site URL: your deployed application's origin.
- Redirect URLs: `https://thp-fall-2026-col7.vercel.app/auth/callback` and `http://localhost:3000/auth/callback`.
- If testing on `127.0.0.1` instead of `localhost`, also allow `http://127.0.0.1:3000/auth/callback` and use that host consistently throughout sign-in.

Use the stable production domain `https://thp-fall-2026-col7.vercel.app` for sign-in and submission. A deployment-specific URL needs its own callback allowlist entry.

The application supplies exactly `<current-origin>/auth/callback` as `redirectTo`, with no `next` or other custom query parameters. Supabase necessarily appends the OAuth authorization `code` when returning; the callback consumes it and exchanges it for a cookie session.

## 4. Environment and deployment

Keep the exact existing variable names in `.env.local` and Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

The integration's `SUPABASE_PUBLISHABLE_KEY` is not the same variable name. No service-role or Google secret is used by the application.

Commit/push the app and migration, then deploy to the existing Vercel project. New preview deployment hosts must be explicitly allowed before OAuth works on them.

## 5. Verify end to end

1. Signed out: `/images` stays public, while direct visits to `/profile` and `/members` redirect to `/login`.
2. Choose Continue with Google. Complete Google consent. The application callback is `/auth/callback`.
3. A new account creates exactly one `profiles` row with the same UUID as its `auth.users` row.
4. Missing either name shows the completion prompt; `/members` redirects to `/profile` until both names are present.
5. Save both names and optionally upload a photo. The photo appears on the Profile page. Open `/members`.
6. Refresh and sign out/in again. Names and photo persist without duplicate profiles.
7. Replace the photo; verify the new photo displays. Blank names and unsupported/oversized photos are rejected.
8. Sign out; direct protected-route access redirects again.
9. With a second account, confirm the API cannot select/update the first account's profile or upload/read files under its UUID folder. An anonymous API request cannot read profiles or private avatars.

Automated checks: `npm run lint`, `npm test -- --runInBand`, and `npm run build`. If this local environment's Turbopack worker-port restriction recurs, use `npm run build -- --webpack` for a full production/type check.

References:
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/server-side/creating-a-client
- https://supabase.com/docs/guides/auth/managing-user-data

## Member avatar access fix

Apply `supabase/migrations/202610010005_member_avatar_access.sql` after migration
004. This replaces the current-avatar policy's direct query of `profiles`
(which was filtered by owner-only RLS) with the restricted member-directory
function. It also replaces the dashboard policy named
`Authenticated users can view avatars`, whose operation filter did not allow
URL signing and whose download rule exposed all avatar history to members.

Keep the avatars bucket private and the `Read own avatar` policy in place.
Do not add a bucket-wide authenticated SELECT policy: members should see only
current directory photos, while owners can still access all of their own photos.
Signed URLs already issued remain usable until their expiry (currently one hour).

Verify with two signed-in accounts after applying the migration:
- Each account can see the other's current photo on `/members` after refresh.
- Each can still view its own previous photos on `/profile`.
- Signing/downloading the other account's historical photo path is denied.
- Anonymous requests cannot sign or directly download private avatars.
- Names and email addresses remain inaccessible through the member directory.

The favorite-joke helper text now discloses member visibility and possible use
for personalized joke suggestions and generation. This is a disclosure only;
no new recommendation, generation, or data-sharing pipeline is implemented.
