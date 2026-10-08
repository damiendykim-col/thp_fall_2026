# Winners gallery

Images now defaults to **Winners**, with the existing Cards/List/Table gallery under
**Templates**. Winning cards pair the original image with its winning caption,
label that caption Human-written or AI-generated, and link to the source results.

## Deployment

Run `supabase/migrations/202610070001_challenge_winners.sql` once in the hosted SQL
editor, after the Stage 1 challenge migration. Then deploy the app. No data backfill,
new credentials, buckets, or scheduled jobs are required. Existing eligible challenges
appear automatically. This work applies the migration only to the local test stack.

## Eligibility and access

The database returns only published challenges whose deadline has passed, with
exactly two candidates, a unique highest score, and at least one non-creator vote.
Ties and zero-vote rounds do not produce winners. Results are ordered by closing time,
newest first, limited to 50. A win means winning that challenge, not broad popularity.

No files or captions are copied. Uploaded images retain their private bucket and use
batched signed URLs with the viewer's session. Winners remain authenticated-only,
matching the existing challenge audience; Templates stays public. The narrowly
scoped SECURITY DEFINER reader is intentional: it returns only eligible closed
results without granting direct access to the hidden caption table.

Eligibility is derived, so if votes are removed by account deletion, a result can
change or leave this gallery. Permanent historical awards are a separate product choice.

## Verification

BDD cases cover human/AI winners, open/draft exclusion, ties, zero votes, anonymous
access, labels, original results links, and public template controls. A regression
also verifies that an early client-side deadline refresh keeps checking the server
at five-second intervals until authoritative closed results arrive.
