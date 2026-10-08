# End-to-end tests

The suite uses Playwright Chromium against Next.js on **127.0.0.1:3100** and a
separate local Supabase Docker project named **meme-club-e2e**, API port **55421**.
It never uses the hosted course project or the app's .env.local credentials.

## First run

With Docker running and Node 22 installed:

```sh
npm ci
npx playwright install chromium
npm run e2e:setup
npm run test:e2e
```

Setup copies the actual repository migrations, plus the reviewed final profile
cleanup, into an ignored local CLI workdir. It adds the dashboard-created images
table and two deterministic gallery fixtures. No mock Supabase API is used.
The cleanup copy affects only this disposable local database; it does not rerun
cleanup remotely. Setup downloads Supabase's containers on its first run.

A startup probe checks the local API and seeded gallery before browser tests run.
The runner starts its own dev server, refuses to reuse a server already on port
3100, and overrides the public Supabase environment variables. Its Next build
output uses .next-e2e so the normal dev server can keep using .next.

## Commands

- `npm run test:e2e`: run the suite; failure screenshots/traces are retained.
- `npm run test:e2e:ui`: open Playwright's interactive runner.
- `npx playwright show-report`: view the last HTML report.
- `npm run e2e:stop`: stop the isolated containers; retain local data.
- `npm run e2e:reset`: **erase only this local E2E database** and replay its
  migrations/seed. Run setup first after changing migration files to refresh
  the generated copies. Never use --linked or --db-url for this workflow.

## Manual sign-in without Google

```sh
npm run e2e:setup
npm run e2e:account
npm run e2e:dev
```

The account command prints a newly generated **local-only** test email/password.
Open http://127.0.0.1:3100/login and use the Local test sign-in form.
That account stays available until the local database is reset.

The server-only flag is `E2E_AUTH_ENABLED=true`. The form and server action require:
- NODE_ENV=development;
- no VERCEL environment marker;
- an HTTP loopback Supabase URL (localhost, 127.0.0.1 or ::1).

Production builds reject this path even if the flag is accidentally set. Missing
or false flags also disable it. The action checks again even when called directly.
Password authentication creates a **real Supabase session**; route checks,
signup/email triggers, RLS, Storage policies and the save RPC all remain active.
The local app server receives the isolated project's service-role key for challenge
uploads and generation writes; that key is not exposed to the browser. Test fixtures
also use the local admin key to provision disposable accounts and clean up their
own uploads/accounts. The runner overrides hosted credentials and uses deterministic
mock captions, so no real Gemini key is needed.

Do not set the flag for your normal hosted backend; the guard intentionally rejects
it. Google consent and Google's own OAuth redirects still need occasional manual
smoke testing. Admin-created local test users exercise the database signup trigger,
but do not represent Google provider behavior.

## Coverage and isolation

- Public gallery sorting, all layouts, image dialog.
- Anonymous profile/member route redirects.
- New user rows, nullable names and incomplete-profile onboarding.
- Save, directory privacy, session persistence and sign-out.
- Text draft restoration, edited cues and discard.
- GIF upload through Storage, previous-photo selection and persistence.
- Two-user current-avatar visibility and restrictions on identity/history reads.
- Rejected cross-user photo selection, anonymous directory reads and direct writes.
- Challenge upload, image-description confirmation/edit/replacement, cached analysis, and manual fallback.
- Mock caption generation, publication, blind voting, undo/switch, and timed reveal.
- Generation claim exclusivity, retries, and rejection of forged or cross-user writes.
- Winner eligibility, attribution after closing, and anonymous access restrictions.

Every authenticated test creates unique accounts. Fixture teardown removes only
those users' files, then deletes those accounts (database cascades remove rows).
Interrupted runs may leave disposable data; use e2e:reset to clear it. Tests use
one worker to keep state and service load predictable. There are no automatic
retries hiding failures.

The suite tests the final normalized schema: legacy history/columns are absent.
The ordinary Jest suite remains separate and covers flag guards in production,
hosted environments and disabled configurations. E2E uses development mode because
the test sign-in deliberately does not exist in production behavior; the production
build remains a separate validation step.

## CI

.github/workflows/e2e.yml starts the same local stack for main pushes and pull
requests. It requires no Supabase secrets or Google credentials. Failure artifacts
may include local test sessions and passwords: they are ignored by Git and CI
retains reports for seven days. Never put production sessions in those artifacts.

Reference: [Playwright fixtures](https://playwright.dev/docs/test-fixtures),
[Playwright web server](https://playwright.dev/docs/test-webserver),
[Supabase local development](https://supabase.com/docs/guides/local-development/cli/getting-started).


## Historical validation record

This dated snapshot is not the current test count or CI status.

October 5, 2026: all 6 Chromium E2E tests passed against the isolated local
Supabase stack (24 seconds). All 65 Jest tests and ESLint passed. This exercised
real Auth sessions, signup triggers, profile-save transactions, Storage uploads,
and cross-user RLS after the final schema cleanup. Google OAuth itself remains
outside the automated suite. GitHub Actions is configured but not run remotely yet.
