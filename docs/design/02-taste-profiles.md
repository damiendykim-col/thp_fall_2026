# Stage 2 — Semantic analysis and user taste profiles

Status: Stage 2A pilot harness is implemented; no live embedding evaluation has run.
pgvector is enabled. Gemini Embedding 2 is the pilot candidate, not a production
selection; dimensions and schema remain undecided.
See the [pilot guide](../../scripts/experiments/taste/README.md) for model roles,
budget, test commands and human-review prerequisites.
Depends on [closed caption challenges](01-caption-challenges.md).
Feeds [Members graph](03-members-graph.md).

## Outcome and direction

Represent users' humor preferences as vectors derived from the image/caption pairs
they upvote. Semantic similarity can connect people who have not voted on the same
challenges. Shared-challenge agreement remains a distinct, observed signal.

The vector represents content preferences, not personality, mental health, beliefs
or character. “Likes dark humor” must not become a claim about those other traits.

## Delivery gates

**2A — Evaluate representations first.** Use a small curated set of image-caption
pairs. Include same image/different captions, similar topics/different humor,
different topics/similar humor, topical versus evergreen jokes, and GIF examples
where selected frames omit important timing. Compare structured style features,
embeddings, and their combination against human judgments. Record disagreements,
latency, usage/cost and model-input limitations. Decide the sample budget and
acceptance criteria before calling providers; neither has been fixed yet.

Choose an embedding model or defined feature space after checking current access,
multimodal support and data handling. The existing Gemini caption model/API key
does not settle that choice. Do not select vector dimensions or add production
analysis tables before this decision. Image-only similarity is a separate possible
use case; it is not sufficient evidence of humor preference.

**2B — Versioned private analysis.** Persist reproducible image-caption analysis,
retry state and provenance independently of generation and moderation. Validate
idempotency, access controls and version compatibility with tests before integration.

**2C — Private taste summaries.** Derive experimental aggregates from final closed
ballots. Evaluate weighting and confidence; settle disclosure, participation and
retention before user-facing release. The member graph and generation
personalization remain later work, not part of 2A.

## Proposed pipeline

1. Take an immutable published image/caption pair and its recorded image-input
   representation. Analyze each candidate independently, using the same method.
2. Produce structured, overlapping semantic labels and a consistent embedding.
3. Store the input fingerprint, taxonomy/prompt version, embedding model/version,
   vector dimensions and analysis status. Reuse matching results.
4. After challenge closure, consume the final active ballots.
5. Derive a user vector and separate evidence/confidence metadata.
6. Publish only the permitted aggregate representations to member discovery.

Analysis may run before closing in a private backend, but the graph/taste summaries
must not expose choices from open challenges. Analysis failures do not block voting
or publication. Processing should be idempotent and retryable; use a background job
when operational needs justify it.

## Representing humor

Suggested dimensions to evaluate:

- Style: dark, absurdist, observational, wordplay, self-deprecating.
- Subject: college, relationships, work, NYC, money.
- Delivery: deadpan, exaggerated, ironic.
- Image relationship: visual contrast, reaction, familiar meme context.

Labels overlap and may be uncertain. The instructors' taxonomy should be reviewed
before choosing our own. Keep structured analysis separate from generation: a
requested genre is not evidence that the output successfully expresses that genre.

Use an embedding model or defined numeric feature space, not arbitrary coordinates
invented by an LLM. Every compared vector must use a compatible model/version and
feature definition. A migration to a new embedding space requires recomputation or
separate comparison groups; do not mix incompatible vectors.

General text embeddings may measure topic similarity more strongly than humor
style. Evaluate actual examples before choosing a model or combining dimensions.

## Building the taste vector

An initial experiment is a normalized aggregation of embeddings for upvoted
candidates, alongside explicit style features. Treat it as a baseline, not a settled
formula. Preserve enough provenance to recompute the aggregate.

An upvote is a relative choice between two captions. It is not endorsement of every
label on the winner. The unselected caption is not an explicit dislike; abstention
is missing evidence. Genre frequencies and prolific creators/challenges can also
bias aggregates, so test weighting rather than assuming a mean is sufficient.

Only the final active vote at closure contributes. A pre-close undo contributes
nothing; switching changes the selected candidate. There are no post-close vote
changes in Stage 1. Content removal/account deletion and analysis-version changes
need a defined recomputation policy.

Do not let Human/AI origin itself define humor similarity. If origin preferences are
ever explored, they are a separate question.

## Time and context

Keep lasting humor-style preference distinct from temporary relevance: finals,
weather, campus events and sociopolitical news can affect a choice. Evaluate topic
and temporal bias alongside style similarity. See [temporal context](04-temporal-context.md)
for the deferred provider contract and measurement decisions.

Current votes contain voter, challenge and caption IDs, without vote timestamps
or impression records. Publication/closing times do not reconstruct when someone
saw or voted on a joke. Do not claim exposure-adjusted traction or historical trend
measurements from the current rows. Timestamp/event-history and exposure collection
need a deliberate design before that work; do not fabricate missing history.

## Confidence and cold start

Keep evidence count, shared-comparison count, coverage and version alongside the
vector. A user with two votes must not appear equally well-understood as one with
fifty. Minimum evidence thresholds are open decisions requiring real observations.

No-vote users have no inferred location. Favorite jokes can remain self-description;
using them to initialize taste vectors would be a separately explained, optional
feature, not equivalent to voting evidence.

## Privacy and access

Proposed: opt-in participation in taste discovery, with a clear explanation and an
option to inspect the inferred summary. Decide separately whether users can hide
only their summary or remove themselves from discovery entirely.

Raw ballots, prompts and raw user vectors should not be exposed to other members.
Serve only the needed derived similarities/explanations. Small aggregates can reveal
individual preferences; define minimum overlap and disclosure thresholds before
showing exact agreement counts.

Any third-party analysis must use disclosed data handling. Store prompts needed for
reproducibility privately; do not send profile names/email as analysis context.

## Validation and acceptance

- Identical inputs/version reuse analysis rather than paying repeatedly.
- Undo, switch and absent ballots produce correct final contributions.
- Open challenges do not change publicly visible taste relationships.
- Sparse evidence is marked insufficient rather than given confident labels.
- Recomputing from canonical closed ballots reproduces the derived profile.
- Compare examples with similar topics/different humor and different topics/similar
  humor to test whether the representation captures the intended distinction.
- Model failures or version upgrades do not corrupt existing compatible results.

Open decisions: taxonomy, model, weighting, thresholds, opt-in UX, retention/deletion
behavior, analysis costs and whether structured labels plus embeddings outperform
a simpler style-only baseline.
