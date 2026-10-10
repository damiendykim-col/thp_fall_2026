# Temporal context — future capability

Status: agreed design consideration; provider integration and tracking are deferred.
Related: [current priorities](README.md), [taste experiment](02-taste-profiles.md).

## Purpose

Relatability changes with weather, semester milestones, campus life and current
sociopolitical events. Distinguish durable humor preferences, temporary context and
the lifecycle of a joke. A burst of finals jokes is not evidence of a permanent
academic-humor preference. Temporal correlation alone does not establish cause.

## Proposed provider-independent record

A context item should carry a topic/summary, source reference, retrieval time,
applicable start/end dates, optional location/scope, and verification/confidence
status. Provider/model versions and a stable item/version identifier allow us to
reproduce the context selected for generation. These are conceptual fields, not a
committed database schema.

Potential sources include a manually curated academic calendar, weather APIs and
current-events providers. A future MCP integration could supply the same contract.
An MCP connection used by the coding assistant does not automatically run in the
Vercel app: runtime integration needs its own authentication, limits and execution
path. No provider, paid service, scheduled ingestion or news scraping is selected.

Prefer a small manual context set for evaluation. External text is untrusted data,
not instructions. Retain attribution, handle conflicting/stale sources, and avoid
inferring a user's political beliefs or precise location from joke preferences.

## Generation and analysis

Select only relevant, applicable context; avoid forcing topical references into
unrelated images. Save the exact context snapshot used with a generation, including
selection time and provenance. Expired context should stop influencing new
suggestions but remain interpretable in historical records.

Compare recent signals with a longer-term baseline as an experiment. Neither time
decay nor window size is settled. Keep style, subject and temporal relevance
separable so trends do not silently redefine the durable taste vector.

## Measurement decisions before implementation

Current challenge timestamps establish publication and closing, not exposure or
vote time. Current active ballots have no timestamp/event history. Historical
impressions and undo/switch timing cannot be recovered from those rows.

Decide whether vote timestamps suffice or an event history is justified, and define
what constitutes an exposure before collecting impressions. Specify retention,
access, duplicate handling and privacy impact. Raw vote counts alone cannot measure
comparative traction without exposure information. Do not label the existing blind
competition a controlled A/B experiment.

Keep temporal analysis out of publicly visible taste updates for open challenges.
Any future administrative reset/republication must exclude invalidated votes and
identify the relevant voting round; existing maintenance resets are not an event log.

## When to revisit

During Stage 2A, include temporal examples and record representation/provenance
needs. Defer automated feeds, trend dashboards, exposure instrumentation and
context-guided generation until the representation experiment is useful and a
bounded product question justifies collecting the data.
