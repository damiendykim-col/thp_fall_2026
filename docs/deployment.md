# Deployment and database lifecycle

Current reference, October 15, 2026. Vercel deployment does not apply SQL migrations.
Use [local E2E](e2e.md) for disposable accounts/content and migration replay.

## Database

- **Fresh database:** apply the complete canonical `supabase/migrations` sequence in
  version order. It includes images bootstrap, profile normalization/cutover,
  challenges, moderation, GIF support, grants and editable drafts. Do not separately
  run historical manual cleanup files.
- **Existing database:** compare its migration ledger and actual schema with the
  repository before applying only pending versions. If history was manually managed,
  reconcile it with evidence; never blindly replay old SQL or mark it applied.
- Review migrations and preserve a recoverable backup before production changes.
  Apply before deploying code that depends on them, and verify expected grants,
  RLS, functions and relevant flows afterward.
- The editor requires `20261015003108_editable_challenge_drafts.sql`. Creation steps
  and arrival/return UI add no migrations of their own. Draft cancellation requires
  `20261015203344_cancel_challenge_drafts.sql` before deploying its UI.
- October 10 [maintenance](database-maintenance-2026-10-10.md) records the last hosted
  audit documented here, including known original-images schema differences. The
  editor was verified locally during implementation; this audit does not establish
  whether its migration is now applied remotely.

Historical `supabase/manual` files are operator records, not a second migration
history. The paired admin project shares this database; coordinate changes here.

## Configuration

Use `.env.example` for exact variable names:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: public connection settings.
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`: server-only privileged operations.
- `GEMINI_API_KEY`: server-only provider credential.
- Optional `GEMINI_MODEL`, `LLM_PROVIDER`: [provider defaults and limits](design/01-stage-1-setup.md).

Set variables in each intended Vercel environment. Never expose administrative or
provider keys through `NEXT_PUBLIC_`, commit them, or enable hosted E2E authentication.
Presence of old configuration is not proof that a model/key is currently available.

## Google OAuth

Enable Google in Supabase using a Web application OAuth client. Configure the
consent audience and testing accounts as appropriate. Google's authorized redirect
URI is the project's Supabase `/auth/v1/callback`, not the app callback.

Set Supabase's Site URL to the stable app origin and allow the exact
`<app-origin>/auth/callback` for each supported production/preview/local origin.
Keep localhost and 127.0.0.1 distinct and use one host throughout a login. The app
supplies a callback URL; Supabase appends the authorization code. Root-code recovery
exists, but is not a replacement for the correct callback allowlist. Do not log or
share authorization codes or sessions when investigating redirects.

## Release verification

1. Run lint, unit tests, production build and isolated E2E; inspect required CI results.
2. Confirm the deployed commit, required migrations and environment configuration.
3. Test a fresh Google login and return to the intended challenge, plus sign-out and
   repeat login. Incomplete profiles currently go through name onboarding.
4. Create/reopen/edit a draft, review an upload, generate with the real provider,
   and publish. For GIFs verify full-animation moderator approval before publication.
5. With another account, check blind captions, vote/undo, ownership restrictions,
   and closed Results. Check mobile layout, draft resumption and recent activity.
6. Check reporting/moderator permissions using [moderation setup](moderation.md).
   Moderator membership is provisioned by trusted administration, not profile input.

Local mock tests establish application behavior, not real model quality, provider
quotas, OAuth configuration or hosted latency. Record those checks with date and
commit rather than turning a past success into a permanent deployment claim.

## Action failures and login diagnostics

Server Actions may return HTTP 200 carrying an error result. Monitor structured
`app-operation` entries by `operation` and `outcome`, not HTTP status alone.
`failed` is error level; expected claim conflicts/limits are `rejected` at info
level. Logs never include prompts, raw provider messages, tokens, or callback URLs.
`PGRST202` on generation.claim indicates a missing/mismatched function or stale
PostgREST schema cache; verify migration/schema before retrying generation.

OAuth logs distinguish auth.exchange, auth.profile, and auth.callback failures.
The callback requires successful cookie writes and keeps auth-return on exchange
failure. A successful local password-login E2E is not verification of Google OAuth.
Retest a fresh production Google login after deployment and inspect the new logs
if it still requires a second attempt.

Redirect entries must include `https://` and the complete callback path. For this
project, preview names follow `thp-fall-2026-<deployment>-col7.vercel.app`; exact
URLs are preferred. Do not switch origin mid-login: PKCE cookies belong to the
origin that initiated it. Correct production callback configuration does not
prove preview configuration or session handoff works.
