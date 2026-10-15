# Winner RPC — compatibility reference

The winner-only gallery UI and its application loader are retired. Current
[Results](arrival-and-return.md) displays all closed rounds, including ties and
no-vote rounds, 12 per page. `/images` redirects to Results; the public template
gallery remains at `/images?view=templates` and in challenge creation.

## Retained database contract

`list_challenge_winners` remains available and tested. Its migration,
`202610070001_challenge_winners.sql`, is part of the canonical sequence; use the
[deployment guide](deployment.md), not a separate manual gallery rollout.

The RPC returns visible published challenges past their deadline with exactly two
candidates, a unique highest score and at least one non-creator vote. Ties and
zero-vote rounds are excluded. It returns at most 50, newest closing time first.
A win means winning that challenge, not broad popularity.

It is authenticated-only. The scoped SECURITY DEFINER reader does not grant direct
access to hidden caption tables. No captions/files are copied into a winner table.
If account deletion removes votes, derived winners may change; permanent awards
would require a separate product decision.

The current Results page uses the protected challenge reader, not this winner-only
RPC. Keep its database tests while callers/compatibility requirements remain; remove
it only after a deliberate dependency audit, not merely to silence advisor warnings.
