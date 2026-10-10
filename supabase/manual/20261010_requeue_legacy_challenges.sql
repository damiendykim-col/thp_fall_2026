-- One-time hosted content maintenance authorized in chat, October 9 Phoenix time.
-- Return the two pre-moderation challenges to creator review. Preserve captions.
-- Not a schema migration; deliberately aborts if rerun or preconditions changed.
begin;
set local lock_timeout='10s';
do $$
declare
  targets uuid[] := array['dc41febe-3f20-4f69-9fda-cbbe9c73257d','6cff1cca-3532-43b4-88f9-ef5dd2703671']::uuid[];
  affected integer;
begin
  perform 1 from public.challenges where id=any(targets) order by id for update;
  if (select count(*) from public.challenges where id=any(targets)
      and status='published' and hidden_at is null and template_id is not null
      and human_moderation_id is null and ai_moderation_id is null)<>2 then
    raise exception 'Legacy challenge state changed; review before proceeding';
  end if;
  if exists(select 1 from unnest(targets) t(id) where
      (select count(*) from public.challenge_captions c where c.challenge_id=t.id)<>2) then
    raise exception 'Expected two preserved captions per challenge';
  end if;
  delete from public.challenge_votes where challenge_id=any(targets);
  get diagnostics affected = row_count;
  if affected<>2 then raise exception 'Expected two votes, found %; transaction rolled back',affected; end if;
  update public.challenges set status='ready',published_at=null,closes_at=null
    where id=any(targets);
  if exists(select 1 from public.challenge_votes where challenge_id=any(targets)) then
    raise exception 'Votes remain';
  end if;
end $$;
commit;
