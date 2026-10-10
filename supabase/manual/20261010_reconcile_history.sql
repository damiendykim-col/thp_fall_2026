-- One-time history reconciliation after catalog verification; not schema replay.
-- Hosted project uiakihcaipqkqbvvnsub. No application rows are changed.
begin;
lock table supabase_migrations.schema_migrations in exclusive mode;
update supabase_migrations.schema_migrations set version='202610090001'
where version='20261010064417' and name='gif_challenges';
update supabase_migrations.schema_migrations set version='20261010064144'
where version='20261010064436' and name='tighten_template_grants';
insert into supabase_migrations.schema_migrations(version,name) values
('202609240001', 'images'),
('202610010001', 'profiles'),
('202610010002', 'profile_email'),
('202610010003', 'avatar_gifs'),
('202610010004', 'member_profiles_and_avatar_history'),
('202610010005', 'member_avatar_access'),
('202610020001', 'harden_auto_rls'),
('202610020002', 'split_member_profiles'),
('202610020003', 'profile_save_api'),
('202610020004', 'finish_profile_cutover'),
('202610050001', 'caption_challenges'),
('202610070001', 'challenge_winners'),
('202610080001', 'image_descriptions'),
('202610080002', 'challenge_moderation'),
('202610080003', 'fix_generation_quota')
on conflict(version) do nothing;
commit;
