# Three-stage challenge creation

Release 3 — October 14, 2026.

## User flow

1. **Image:** upload or choose a template; confirm GIF frames when applicable, then
   review the description. The provider disclosure stays before the upload control.
   **Continue to caption** requires completed image review and explicit confirmation.
2. **Your caption:** write the contender alongside a small image preview; optionally
   supply context. The caption is checked for safety but never given to the opponent
   generator. **Create draft** saves a private draft and opens its preview.
3. **AI opponent & publish:** generate the opponent, inspect both captions, and
   explicitly publish for 24 hours. Generating does not publish. Attribution stays
   hidden from voters until closing.

The first two stage buttons allow moving back and forth, including writing a joke
while an image is still being reviewed. This does not bypass the image confirmation
requirement. A changed image/description resets confirmation without clearing the
caption. Required controls remain mounted so the same Server Action receives the
complete form; only the active stage is visible. Stage changes focus the heading.

## Recovery and editing

Existing tab-local recovery remains scoped to the account. Reload starts at image
review with saved text and uploaded references restored. Local file bytes are not
persisted. GIF confirmation and interrupted-description retry retain their existing
behavior. Discard clears the unfinished work and returns to the image stage.

Editing a saved draft deliberately keeps both groups visible: a creator can make a
small revision without repeating the creation walkthrough. Revision invalidation,
moderation, generation limits, and publishing restrictions are unchanged.

## Rollout and verification

This release needs no new migration, provider call, or dependency. It assumes the
previous draft-editing release is already installed. Browser coverage follows the
staged flow through upload, GIF review, recovery, moderation failure, generation,
and publication; component coverage checks navigation and confirmation invalidation.

Next planned item: improve empty home/results states. Taste/persona work and the
member graph remain separate from this UX sequence.
