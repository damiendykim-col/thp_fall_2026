-- Index referencing columns for foreign-key maintenance and related lookups.
-- These non-unique indexes do not change access rules or existing data.
create index challenge_images_animation_reviewed_by_idx
  on public.challenge_images (animation_reviewed_by);
create index challenge_images_moderation_id_idx
  on public.challenge_images (moderation_id);
create index challenge_template_reviews_reviewed_by_idx
  on public.challenge_template_reviews (reviewed_by);
create index challenges_ai_moderation_id_idx
  on public.challenges (ai_moderation_id);
create index challenges_asset_moderation_id_idx
  on public.challenges (asset_moderation_id);
create index challenges_human_moderation_id_idx
  on public.challenges (human_moderation_id);
create index challenges_hidden_by_idx
  on public.challenges (hidden_by);
create index challenges_template_id_idx
  on public.challenges (template_id);

-- Intentionally omit member_profiles(profile_id, current_avatar_path): the
-- existing primary key on profile_id already narrows that lookup to one row.
