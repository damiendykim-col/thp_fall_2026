# Arrival and return visits

Release 4 — October 15, 2026.

## Experience

- Signed-out visitors retain the interactive illustrative example and Google login
  entry points. Example selections never write votes.
- An empty signed-in Open feed offers the latest saved draft to resume, or a new
  challenge to start. A collapsible, explicitly labeled example remains available.
  Empty Results no longer sends people around an Open/Results loop.
- Open shows a compact return section: one recent unfinished challenge and up to
  three closed rounds the user created or currently has a vote in. These are
  **recent results**, not unread/new notifications. Undoing a vote removes that
  association; there is no invented voting history.
- If every displayed open round is already voted on or belongs to the viewer,
  acknowledge it while keeping all cards available. Own-only rounds say they are
  awaiting community votes. At the existing 50-card limit, wording refers only to
  the displayed rounds rather than claiming the whole feed is exhausted.
- Results shows both captions, attribution, totals, closure time, and a full-results
  link for every completed outcome: winner, tie, or zero votes. It is sorted by
  closing time and ID, with 12 rounds per page and previous/older navigation.

## Data boundaries and cost

All reads use the signed-in Supabase client and existing RLS; no service key,
permission change, schema migration, AI request, or shared personalized cache is
introduced. Activity reads run in parallel with feed loading. Each of the three
activity queries is bounded: one draft, three owned results, three voted results;
the latter two are deduplicated and reduced to the most recent three.

Results reuses `read_caption_challenge` to preserve its database-time disclosure
check and hidden-content handling. Each page reads up to 13 IDs (one lookahead),
then at most 12 existing RPCs concurrently, plus one batch signed-URL request when
needed. This favors reuse of the established security boundary over a new summary
RPC. It is bounded, but still costs more database requests than a dedicated batch
endpoint; measure production latency before scaling it further. Offset pagination
can shift when rounds close or are hidden between visits; it is not a frozen snapshot.

Failures are shown as errors, not as empty results or invented voting states.
The existing winner-list RPC remains available and covered by E2E tests. Its unused
winner-only app component and loader were removed.

## Verification

Component/data tests cover empty actions, recent labels, caught-up/own-only states,
all result outcomes, query bounds, invalid page parameters, and failed reads.
Local browser tests cover a new account, example non-mutation, resuming a draft,
voting/undo, personal result relevance, hidden exclusions, all outcomes, pagination,
and mobile overflow. Existing authentication, moderation, GIF and editing scenarios
remain regression requirements.

Optional-name onboarding, notifications, taste profiles, and the member graph are
outside this release. No production migration or content mutation is needed.
