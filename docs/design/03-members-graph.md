# Stage 3 — Members: interactive humor-similarity graph

Status: follow-up product design, separate from Challenges.
Depends on [taste representations](02-taste-profiles.md).

## Agreed direction

Members is a place to navigate relationships between users' humor preferences.
It is not the challenge feed. User taste vectors should inform graph placement.
Keep avatar-based presentation without exposing private names or emails.

## Proposed first experience

A viewer-centered neighborhood graph places the current member in the center and
a manageable set of similar, participating members around them. Nodes use avatars.
Selecting a node opens an adjacent detail panel with its favorite joke, permitted
taste summary, evidence explanation and a route to published contributions.

The graph is exploratory; it must not suggest a permanent ranking of people. Keep
the existing “You” identity and clear own-profile editing affordance. Links to other
members' contributions are distinct from private profile editing.

Use the existing black/yellow theme: neutral connections, yellow selected/focused
node, and restrained emphasis. Do not encode every genre with a different color.

## Coordinates versus similarity

High-dimensional user vectors determine similarity. Two-dimensional coordinates
are a projection or layout of those relationships, not the taste representation
itself. Store/cache coordinates as replaceable presentation data.

For the first graph, compute a bounded neighborhood around the viewer. Evaluate a
similarity-weighted layout with stable initialization and movement constraints.
Do not choose a projection algorithm before evaluating available data and scale.
An eventual global map is a different product: it introduces stability, clustering
and interpretation issues that a viewer-centered graph avoids.

Two-dimensional distances distort some relationships. The detail panel must explain
why a connection exists; position alone is not evidence. Clearly define the meaning
of edges and distance. Incidental closeness between two neighbors should not imply
that their mutual similarity has been measured or shown.

## Two distinct evidence channels

- **Inferred:** similar semantic/style preferences derived from closed votes.
- **Observed:** agreement on challenges both people voted on.

For example, “Similar humor styles” is model-derived, while “Same choice in 7 of 9
shared challenges” is an aggregate observation. Use exact counts only when the
privacy/overlap policy permits. Do not present these as interchangeable measures.
Confidence/evidence is separate from coordinates and must remain inspectable.

## Cold start and interaction

Until enough evidence exists, keep the current member list/cards and explain that
more closed-challenge votes are needed. Do not place users arbitrarily and imply
those positions represent taste. Opted-out users must not silently receive nodes.

Support:
- Pointer/touch selection, optional pan/zoom, and reset-to-your-node.
- Keyboard access to members and the detail panel; visible focus and dismissal.
- A list alternative with equivalent discovery information and actions.
- A responsive small-screen layout and reduced motion.
- Stable placement when returning, so routine refreshes do not rearrange everything.

## Backend and performance boundaries

The browser receives only an authorized neighborhood: opaque member reference,
allowed avatar reference, permitted explanation and layout/similarity data needed
for display. Do not send the entire user-vector corpus or individual ballots.

Compute from eligible, version-compatible profiles with sufficient evidence. Limit
node count and avoid an all-users pairwise comparison on every request. Whether to
use a vector index, cached neighbors or on-demand calculation depends on measured
scale; no separate graph database or microservice is required initially.

Cache keys include the relevant analysis/data version and access context. Recompute
or invalidate when closed-vote aggregates, participation preferences or account
visibility change. Open votes must not affect public graph positions or explanations.

## Acceptance and evaluation

- Members remains a separate route from Challenges.
- Nodes/explanations agree with authorized, version-compatible similarity results.
- Insufficient evidence is distinguished from low similarity.
- Private identity, ballots and pre-close preferences cannot be retrieved through
  graph endpoints or inferred from immediate open-vote position changes.
- Keyboard/list users can reach the same members and details as pointer users.
- Opt-out removes the member from subsequent discovery responses under the defined
  cache policy; existing screenshots or previously delivered data cannot be recalled.
- PM testing asks whether users understand what distance means and whether the
  graph helps them discover people better than the list.

Open decisions: neighborhood size, thresholds, layout algorithm, confidence display,
edge meaning, participation controls, allowed aggregate disclosure and refresh cadence.
