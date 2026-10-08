-- Read-only derived gallery. Reuses challenge media; does not copy or publish uploads.
begin;
create function public.list_challenge_winners()
returns table (
 challenge_id uuid, caption_id uuid, caption text, origin text, upvotes bigint,
 closes_at timestamptz, situation text, image_path text, template_url text
)
language sql stable security definer set search_path='' as $$
 with eligible as (
   select c.id,c.creator_id,c.closes_at,c.situation,c.image_path,c.template_url
   from public.challenges c
   where (select auth.uid()) is not null
     and c.status='published' and c.closes_at <= statement_timestamp()
 ), scores as (
   select c.id as challenge_id, x.id as caption_id, x.body as caption, x.origin,
     count(v.user_id) as upvotes, c.closes_at,c.situation,c.image_path,c.template_url
   from eligible c
   join public.challenge_captions x on x.challenge_id=c.id
   left join public.challenge_votes v on v.challenge_id=c.id and v.caption_id=x.id
     and v.user_id<>c.creator_id
   group by c.id,x.id,x.body,x.origin,c.closes_at,c.situation,c.image_path,c.template_url
 ), ranked as (
   select s.*, rank() over(partition by s.challenge_id order by s.upvotes desc) as place,
     count(*) over(partition by s.challenge_id) as candidates
   from scores s
 )
 select r.challenge_id,r.caption_id,r.caption,r.origin,r.upvotes,r.closes_at,
   r.situation,r.image_path,r.template_url
 from ranked r
 where r.place=1 and r.upvotes>0 and r.candidates=2
   and not exists(select 1 from ranked other where other.challenge_id=r.challenge_id
     and other.caption_id<>r.caption_id and other.place=1)
 order by r.closes_at desc,r.challenge_id
 limit 50;
$$;
-- Definer is intentional: base captions remain unreadable before the reveal.
-- Only this narrowly scoped closed-results projection is exposed to signed-in users.
revoke all on function public.list_challenge_winners() from public, anon;
grant execute on function public.list_challenge_winners() to authenticated;
commit;
