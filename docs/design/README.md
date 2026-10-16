# Meme Club: current plan

Updated October 15, 2026 (America/Phoenix). This is the authority for priorities and
decision status. [Documentation map](../README.md) separates current references from
historical rollout records. No implementation or deployment is implied by a proposal.

## Completed in the repository

The challenge-first black/yellow experience is the product focus. Signed-out visitors
get an illustrative interactive example; real challenges and results require sign-in.
Open / Results / Yours, creation and the account menu are the main navigation.
Members remains separate and outside primary navigation.

- Human versus AI captions, 24-hour voting, one reversible upvote per account per
  challenge, no creator voting, and blind attribution/totals until closure.
- Still/GIF uploads, confirmed descriptions and GIF frames, optional joke context,
  pre-publication checks, reports and manual full-animation GIF review.
- Profile editing, avatar history, and member discovery without names/emails.
- The four-part UX review is implemented: upload/retry recovery; revision-safe
  unpublished draft editing; three-stage creation; improved arrival/return visits.
- Home offers compact draft-resumption and Results links; challenge cards take priority over activity summaries. Open cards identify ownership
  and existing votes. Results includes ties and no-vote rounds, 12 per page.
- Local Auth/database/Storage E2E coverage and required unit/E2E GitHub checks.

See [creation](../challenge-creation.md), [editing](../challenge-editing.md), and
[arrival/return](../arrival-and-return.md) for current behavior. Names are not a
challenge authorization requirement, but login still routes incomplete profiles
through name onboarding; making that optional is not implemented.

## Next: close the release, then respond to observed friction

1. Verify the deployed commit and pending database migrations. The editable-draft
   migration is required for the new editor. Follow [deployment](../deployment.md);
   do not replay old profile cleanup or assume a Vercel deploy applies SQL.
2. Smoke-test Google login/return, draft editing, creation, voting and Results with
   separate accounts, including mobile. Local mocks do not verify live Gemini.
3. Measure deployed arrival/Results navigation if delay remains noticeable. Results
   uses bounded per-round reads; prefer measured improvements over a new architecture.
4. Collect TA/PM feedback on the streamlined challenge flow. Choose the next small
   change from observed friction. Optional name onboarding is a candidate, but needs
   an explicit decision about Members eligibility and existing redirects first.

These are release checks, not claims of a new defect. October 10 hosted maintenance
is recorded separately; later hosted migration/deployment status has not been
re-audited in this documentation pass. No further schema overhaul is justified by
this audit alone. The admin app is a separate workstream; shared migrations remain
owned by this repository.

## Taste: private evaluation complete enough for feedback, production gated

Private tooling supports reviewed corpora, mechanism evidence, embeddings, scene
ablation, bounded/resumable batch execution and compact reports. V1, expanded v2,
context controls, adjudication and a completed v3 run have been exercised. This is
not a validated production taste model. Reviewed held-out data used for revisions
is now development evidence, and v3 examples are not an independent benchmark.

**Pause production taste implementation pending TA/professor feedback** on the use
case and taxonomy. No more API runs are required merely to advance the backlog.
Use the existing evidence to discuss whether the goal is mechanism similarity,
personal preference, or recommendation quality; these are different targets.

After that decision, agree independent evaluation criteria and corpus coverage
before choosing a representation. Only then consider versioned private analysis
(2B), private closed-ballot taste summaries (2C), and downstream discovery.
pgvector availability does not settle model, dimensions, thresholds or schema.
See [Stage 2](02-taste-profiles.md) and the [experiment guide](../../scripts/experiments/taste/README.md).

## Deferred, with explicit triggers

- **Open/Yours pagination:** both remain bounded to 50; revisit when users cannot
  reach relevant rounds. Results pagination is already implemented.
- **Storage retention:** define abandoned-upload/draft retention and safe reference
  checks before adding deletion jobs; prioritize if storage growth warrants it.
- **Exact legacy schema parity:** October 10 recorded original-images drift. Use a
  forward migration if that difference affects a feature/test; do not replay history.
- **Caption quality/persona:** postponed pending instructor direction.
- **AI moderation explanations:** optional advisory assessment, distinct from existing
  safety gates; wait for a concrete reviewer need and quota budget.
- **Carousel, watch-style honeycomb, swipe, PvPvE:** future design experiments, not
  requirements for the current two-caption competition.
- **Temporal context:** manual context evaluation before external MCP/API feeds,
  trend collection or exposure instrumentation. [Design](04-temporal-context.md).
- **Members graph:** follows useful, permissioned taste evidence. [Design](03-members-graph.md).
- Notifications, recommendation ranking, comments and broader social features:
  require product evidence; not part of the current release.

Analysis must not block creation, moderation, publication or voting. Preserve
TDD/BDD for future behavior changes; passing software tests does not validate taste
inference, humor quality or live provider availability.
