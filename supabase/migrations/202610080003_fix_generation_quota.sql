-- Correct the moderation migration quota query. Caption generations use
-- created_at; started_at belongs to moderation_checks. Preserve existing grants.
begin;
create or replace function public.claim_caption_generation(p_owner uuid,p_challenge uuid,p_provider text,p_model text,p_prompt jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.challenges; result uuid;
begin
 perform 1 from public.profiles where id=p_owner for update;
 select * into c from public.challenges where id=p_challenge and creator_id=p_owner for update;
 if not found or c.hidden_at is not null then raise exception 'Challenge unavailable'; end if;
 -- Recover an interrupted request after its server timeout. Old completions cannot win.
 update public.challenge_generations set status='failed',finished_at=clock_timestamp() where challenge_id=c.id and status='running' and created_at<clock_timestamp()-interval '2 minutes';
 if c.status not in ('draft','failed','generating') or exists(select 1 from public.challenge_generations where challenge_id=c.id and status='running') then raise exception 'Generation already started or complete'; end if;
 if (select count(*) from public.challenge_generations where challenge_id=c.id)>=3 or (select count(*) from public.challenge_generations where owner_id=p_owner and created_at>now()-interval '1 day')>=10 then raise exception 'Generation limit reached'; end if;
 insert into public.challenge_generations(challenge_id,owner_id,provider,model,prompt) values(c.id,p_owner,p_provider,p_model,p_prompt) returning id into result;
 update public.challenges set status='generating' where id=c.id;
 return result;
end $$;

commit;
