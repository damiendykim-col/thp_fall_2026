# Arrival and return visits

Updated October 16, 2026.

## Experience

- Signed-out visitors switch between PRACTICE ROUND and SIGN IN in the same view. The signed-out landing header shows only the wordmark;
  signed-in navigation remains available. Five steps cover image choice, caption writing (with an optional
  suggestion), a prepared opponent, voting, and a time-skipped reveal. Back and
  Restart controls keep the walkthrough reversible. Practice state lives only in
  browser memory and disappears on reload; nothing is submitted or carried into
  a real challenge. Switching panels preserves practice progress. The final practice action opens the
  sign-in panel, which reuses Google login with the create-challenge destination.
- Practice explicitly switches from creator to voter: real creators cannot vote on
  their own rounds. The reveal shows authorship and the visitor’s practice pick,
  with no fabricated community totals or winner.
- An empty signed-in Open feed offers the latest saved draft to resume, or a new
  challenge to start. A collapsible, explicitly labeled example remains available.
  Empty Results no longer sends people around an Open/Results loop.
- Open shows compact links to resume the three most recent saved drafts and visit Results when recent personal
  results exist. Individual result summaries stay on Results, keeping challenges
  above the fold. These are not unread/new notifications. Undoing a vote removes
  that association; there is no invented voting history.
- Signed-in members see a compact heading and Challenge AI action. The signed-out
  practice round offers two predefined images and matching prepared captions; it makes
  no provider requests and records no votes.
- If every displayed open round is already voted on or belongs to the viewer,
  acknowledge it while keeping all cards available. Own-only rounds say they are
  awaiting community votes. At the existing 50-card limit, wording refers only to
  the displayed rounds rather than claiming the whole feed is exhausted.
- Results shows both captions, attribution, totals, closure time, and a full-results
  link for every completed outcome: winner, tie, or zero votes. It is sorted by
  closing time and ID, with 12 rounds per page and previous/older navigation.

## Signed-in workspace

- Multiple saved drafts were already supported: the database allows ten new
  challenges per rolling day, with separate generation quotas. This update does
  not impose a three-active-draft cap or increase provider allowances. The three
  return links are a display limit; Yours lists the broader collection.
- Creation keeps the image beside the current step on larger screens and a compact
  preview above it on phones. The matchup uses the same image/captions card.
  Content can grow and scroll for long text, errors, and zoom; no forced viewport
  height clips controls. Editing retains both sections to support revisions.
- Info buttons open keyboard/touch-accessible popovers (Escape or Close dismisses).
  Upload/provider disclosures and actionable errors stay visible.
- Active uploads, analysis, saving, and generation have an animated status graphic,
  respecting reduced motion. Labels represent the known operation, not invented
  percentages or internal substeps. Human GIF review uses a static waiting state,
  with manual refresh, Start another, and View your drafts. Publication stays
  disabled until approval; the database remains authoritative.
- Next/Previous links browse the latest 50 visible open rounds, newest first,
  including already-voted and own rounds. Each detail page makes one bounded,
  viewer-authorized ID query. Navigation never votes, and undo stays available.
  If a round closes, is hidden, or falls outside that window, return to the feed.
  Swipe navigation remains deferred until the explicit navigation is validated.
- Leaving a page is not a guarantee that an in-flight request completes in the
  background. Saved drafts can be reopened to check their actual status or retry.
  No background job queue or notifications are introduced.

## Data boundaries and cost

All reads use the signed-in Supabase client and existing RLS; no service key,
permission change, schema migration, AI request, or shared personalized cache is
introduced. Activity reads run in parallel with feed loading. Each of the three
activity queries is bounded: three drafts, three owned results, three voted results;
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
