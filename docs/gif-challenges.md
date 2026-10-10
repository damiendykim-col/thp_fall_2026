# GIF challenge rollout

GIFs are integrated into Create challenge. The standalone local experiment remains
available, but is no longer needed to create a GIF challenge.

## User flow

1. Upload a GIF (up to 3 MiB, shown as 3 MB), 120 frames, 30 seconds and 40 million
   total decoded pixels. Decode and resize to at most 640px per side, preserve all
   frames and playback delays/loop, strip source metadata, and re-encode GIF.
   Output must also fit 3 MiB. Tiny/zero delays normalize to 100ms.
2. Review the automatic storyboard (up to eight time-based samples including
   endpoints). Accept immediately, or replace frames using the scrubber.
3. Confirmation saves the animated display asset and an immutable set of frame
   indices. A description is generated from the chosen chronological JPEG frames
   and their timestamps. The user reviews/corrects that description as before.
4. Create the draft and generate the opponent from the same saved selection.
   Prompt records include frame indices and a versioned GIF representation. The
   human caption is never included in the opponent's generation prompt.
5. A moderator reviews the complete animation from Moderation → GIF upload reviews
   and approves or rejects it. Automatic safety checks use their own default
   samples, independent of the creator's choices. Sampling alone never grants
   publication approval. Approval is attached to the immutable image record.
6. Publication requires both the existing automated checks and the separate GIF
   review. The database enforces the latter even through direct publish RPC calls.
   A rejected GIF requires a revised challenge using another image.

Changing confirmed frames before draft creation makes a new immutable image
representation and regenerates its description. Reservations are content-hashed
per owner including selected indices: exact retries reuse their record, but new
selections count toward the existing daily limit of ten image reservations. Frame
edits do not alter existing challenges. Selection is frozen when creating a draft.

## Deploy

Apply `supabase/migrations/202610090001_gif_challenges.sql` using the Supabase SQL
editor **before** deploying the app changes. This migration extends image metadata,
updates the existing challenge bucket's allowed MIME types, and adds a moderator
review queue and database publication gate. The extended reservation RPC preserves
old callers through default arguments. No existing image records or challenges
are removed. Avatar handling is unchanged.

The isolated local database has been migrated for testing. Hosted Supabase has not
been modified by this work. Use an existing moderator account; role setup remains
in `docs/moderation.md`. If no moderator is available, GIF drafts can generate but
cannot be published. Test providers do not auto-approve the manual review gate.

Server Actions allow 4 MiB requests to accommodate multipart overhead for a 3 MiB
file. The existing bucket limit is 3 MiB. Larger files require a different upload
path and are outside this change.

## Limits and verification

All processing uses bounded decoded pixel/frame counts and Sharp processing
timeouts. The entire processing operation budgets 15 seconds, including previews.
This is not process isolation or a hard wall-clock/memory guarantee. Preview JPEGs
are capped at 1 MiB total before base64. Production resource/caption-quality tests
on representative real-world GIFs remain useful: automated tests use synthetic
animations and a mock model, while provider request tests inspect serialized
JPEG frame input. No live Gemini output-quality claim is made.

Full-animation review is a human assessment, not an assurance of perfect detection.
Reports and hide controls remain available after publication. Existing gallery GIF
templates continue using moderator-approved assets and text description input;
this change does not fetch arbitrary external template URLs for AI frame analysis.
