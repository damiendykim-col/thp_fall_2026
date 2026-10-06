# Meme Club: staged product design

Design snapshot: October 5, 2026. These documents summarize the discussion; they
are not implemented features or database migrations.

## Delivery stages

1. [Assignment 4: image uploads and caption challenges](01-caption-challenges.md)
   — this week's deliverable: create, publish, upvote, close and reveal.
2. [Semantic analysis and taste profiles](02-taste-profiles.md)
   — classify caption/image pairs and derive evidence-backed user representations.
3. [Members: interactive humor-similarity graph](03-members-graph.md)
   — help members explore relationships between their humor preferences.

Stages describe delivery order, not three independent systems. Stage 1 provides
content and final voting choices; Stage 2 derives representations; Stage 3 uses
those representations for discovery. Stage 1 must work without Stages 2 or 3.

## Product boundaries

- **Images:** existing template library; a place to start a challenge.
- **Challenges:** a separate creation, voting and results experience.
- **Members:** member discovery, eventually through a graph. It does not become
  the challenge feed.
- **Profile:** private identity editing, avatar history and favorite joke.

Retain the minimalist black background and yellow accent. Names and emails stay
out of member discovery. This is not a promise of anonymity: avatars and content
can identify people.

## Decision status

“Agreed” reflects explicit user direction. “Proposed” is a recommended default
that has not been finalized. Open decisions should be settled before implementing
the affected behavior; none should silently become a requirement.

The major Stage 1 decisions still open are the AI provider, duration, upload
limits/formats, regeneration rules, and published-content audience. Later stages
need taxonomy, privacy, confidence and similarity-model decisions.
