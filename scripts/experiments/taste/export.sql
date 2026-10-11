-- Read-only operator query. Populate the UUID array with explicitly selected
-- challenge IDs (maximum six). Empty by default; never exports all user content.
-- Save the returned ROW ARRAY as private JSON for import.mjs, not in Git.
-- Closed only so pilot review does not reveal or bias an ongoing challenge.
with selected as (
  select unnest(array[]::uuid[]) as id
), sample as (
  select c.* from public.challenges c
  where c.id in (select id from selected)
    and c.status = 'published' and c.hidden_at is null
    and c.closes_at <= now()
  order by c.id
  limit 6
)
select c.id as challenge_id, c.status, c.closes_at, c.hidden_at,
  c.image_description as scene, c.description_source,
  (select jsonb_agg(jsonb_build_object('id', cc.id, 'body', cc.body) order by cc.id)
   from public.challenge_captions cc where cc.challenge_id = c.id) as captions
from sample c
order by c.id;
