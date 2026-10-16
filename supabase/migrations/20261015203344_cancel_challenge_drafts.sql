-- Cancellation retains content/audit/quota history, but makes an unpublished draft terminal.
begin;
create function public.cancel_caption_draft(p_challenge uuid) returns void
language plpgsql security definer set search_path='' as $$
declare c public.challenges; viewer uuid := (select auth.uid());
begin
 if viewer is null then raise exception 'Sign in required'; end if;
 -- Same challenge -> generation lock ordering as generation completion.
 select * into c from public.challenges where id=p_challenge and creator_id=viewer for update;
 if not found or c.published_at is not null or c.status='published' then
  raise exception 'Only your unpublished drafts can be cancelled';
 end if;
 update public.challenges set hidden_at=coalesce(hidden_at,clock_timestamp()),hidden_by=viewer where id=c.id;
 -- A late provider response sees a finished claim and cannot add a caption or revive the draft.
 update public.challenge_generations set status='failed',finished_at=clock_timestamp()
 where challenge_id=c.id and status='running';
end $$;
revoke all on function public.cancel_caption_draft(uuid) from public,anon;
grant execute on function public.cancel_caption_draft(uuid) to authenticated;
commit;
