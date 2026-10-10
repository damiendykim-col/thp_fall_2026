# Meme Club: current plan

Updated October 10, 2026 (America/Phoenix). This index is the source of truth for
priority and decision status. Detailed stage documents specify behavior; dated
rollout records preserve history, not additional pending requirements.

## Current product

Challenge-first, minimalist black/yellow UI. Signed-out visitors get a labeled
interactive example; real challenges and results remain signed-in only. Navigation
centers on Open / Results / Yours, creation, and an account menu. Members stays
separate from Challenges and outside primary navigation. Names and emails stay out
of member discovery; avatars/content can still identify people.

Implemented scope:
- Human versus AI caption challenges, 24-hour voting, one reversible upvote per
  account/challenge, no creator voting, blind attribution and totals until closure.
- Still-image uploads and GIF uploads with confirmed sampled frames. Uploaded GIFs
  require full-animation moderator approval as well as automated checks.
- Reviewed image descriptions, optional joke context, reporting/moderation, winners,
  participation badges, profile editing and avatar history.
- Local Supabase E2E setup and required GitHub unit/E2E checks.

Descriptions support accessibility and generation; they are not feed headlines.
Current upload limits and provider settings belong in [Stage 1 setup](01-stage-1-setup.md)
and [GIF rollout](../gif-challenges.md), not duplicated in backlog proposals.

Hosted grants, GIF schema and migration history were verified during
[database maintenance](../database-maintenance-2026-10-10.md). Two legacy challenges
were returned to creator review with votes cleared; they are not awaiting a new
moderator-queue implementation. Database completion is not proof of a live Gemini
GIF smoke test. Verify deployment/commit status from Git and the deployed app when
releasing; do not infer it from an older planning note.

## Next: Stage 2A embedding experiment

[Semantic analysis and taste profiles](02-taste-profiles.md) is next, beginning with
a bounded offline/private evaluation of image-caption pairs. No production embedding provider,
vector dimensions, taxonomy, aggregation formula or evidence threshold is selected.
A [description-only pilot harness](../../scripts/experiments/taste/README.md) now
uses Gemini Embedding 2 as an experimental candidate. Fixtures await human review;
no live model calls or semantic quality results exist yet.
pgvector is available; embeddings and taste profiles are not implemented.

Sequence:
1. Verify current embedding options, multimodal support, cost and data handling.
2. Curate examples that separate humor style from subject matter and timing.
3. Compare structured labels, embeddings and a simple style-only baseline.
4. Record the decision and evaluation before choosing persistent vector schema.
5. Only then build versioned analysis storage and private taste summaries from
   final votes on closed challenges. Set privacy and insufficient-evidence behavior
   before exposing a user-facing feature.

Analysis must not block challenge creation, moderation, voting or publication.
Keep TDD/BDD for implementation; passing plumbing tests does not establish semantic
quality. No automatic paid processing of the existing corpus is implied by this plan.

## Deferred, with preserved intent

- [Temporal context](04-temporal-context.md): separate enduring taste from current
  circumstances; retain a provider-independent contract. External MCP/API feeds,
  exposure tracking and trend-driven generation are proposals, not current features.
- [Members graph](03-members-graph.md): follows useful, permissioned taste profiles;
  no graph UI or projection algorithm in the embedding experiment.
- Caption quality/persona tuning: explicitly postponed; embedding evaluation does
  not change the opponent-generation persona.
- Watch-style honeycomb challenge browsing, carousel/swipe interactions, PvPvE:
  future design session. Preserve the current two-caption voting rules meanwhile.
- On-demand AI moderation explanations: advisory context, not definitive judgment;
  deferred and distinct from existing pre-publication safety checks.
- Pagination, automated orphan retention, notifications and recommendation ranking:
  revisit when usage or product feedback justifies them.

## Document map and decision discipline

- [Stage 1](01-caption-challenges.md): implemented competition contract.
- [Stage 1 setup](01-stage-1-setup.md): operational defaults and release checks.
- [Stage 2](02-taste-profiles.md): experiment gates, later taste pipeline and open choices.
- [Stage 3](03-members-graph.md): deferred discovery experience.
- [Temporal context](04-temporal-context.md): future context inputs and measurement.

“Implemented” requires code/schema evidence; “verified hosted” identifies an actual
hosted check. “Agreed direction” is user intent, not a completed feature. Proposed
algorithms, providers and thresholds remain open until evaluated. Update the current
sections when decisions change rather than appending contradictory status blocks.
