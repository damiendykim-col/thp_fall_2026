-- Run after the profiles migration. Preserve the bucket's privacy and size limit.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'avatars';
