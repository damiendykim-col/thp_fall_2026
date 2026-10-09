# Meme Club: staged product design

Stage 1 is implemented. The project owner has confirmed that production validation
and performance are satisfactory for the current scope. Stages 2 and 3 remain
design proposals; these documents are not database migrations.

The new [reviewed image descriptions](../image-descriptions.md) extension is implemented
locally and requires its migration and deployment; it is outside that earlier sign-off.

## Delivery stages

1. [Assignment 4: image uploads and caption challenges](01-caption-challenges.md)
   — implemented: create, publish, upvote, close, reveal, and browse winners.
2. [Semantic analysis and taste profiles](02-taste-profiles.md)
   — classify caption/image pairs and derive evidence-backed user representations.
3. [Members: interactive humor-similarity graph](03-members-graph.md)
   — help members explore relationships between their humor preferences.

Stages describe delivery order, not three independent systems. Stage 1 provides
content and final voting choices; Stage 2 derives representations; Stage 3 uses
those representations for discovery. Stage 1 must work without Stages 2 or 3.

## Product boundaries

- **Challenges:** home, open rounds, results, personal drafts, and creation.
- **Templates:** part of creation, with a legacy gallery route retained.
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

Stage 1 uses Gemini, 24-hour challenges, authenticated challenge/winner access,
still-image uploads, and one successful AI generation per draft. See the
[implementation guide](01-stage-1-setup.md) for exact limits.

Remaining work is caption-quality/persona evaluation with PM feedback, then the
Stage 2 taxonomy, privacy, confidence and similarity-model decisions. Pagination
and automated abandoned-upload cleanup remain deferred. A first
[challenge moderation and reporting workflow](../moderation.md) is implemented
locally and requires deployment.

## Challenge-first UI revision (October 8)

The home route now presents challenges. Signed-in navigation is Open / Results /
Yours, with creation in the header and Profile / Sign out / role-specific Moderation
in an account menu. Results combines winning captions with links to all finished
rounds, including ties and rounds without votes. Templates are selected inside
creation; `/images?view=templates` remains a compatibility route for earlier course
work. `/images` redirects to challenge Results. Members remains accessible by its
existing route but is no longer primary navigation.

Signed-out visitors currently see a clearly labeled interactive example with no
recorded votes. The project owner approved this signed-out default. Real challenges remain
members-only; this revision does not change upload audiences or database policies.
OAuth retains exactly `/auth/callback`; a short-lived HTTP-only cookie carries an
allowlisted challenge destination, including through profile completion.

Honeycomb discovery (watch-style app tiles), swipe interactions, PvPvE, taste
profiles, and the member graph are deferred. The current work focuses on a clear
entry point, familiar navigation, and the existing two-caption competition.
