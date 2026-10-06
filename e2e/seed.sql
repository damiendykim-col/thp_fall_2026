insert into public.images (id,image_url,description,created_at) values
('11111111-1111-4111-8111-111111111111','data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','Older test meme','2026-09-01T00:00:00Z'),
('22222222-2222-4222-8222-222222222222','data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','Newer test meme','2026-09-02T00:00:00Z')
on conflict (id) do nothing;
