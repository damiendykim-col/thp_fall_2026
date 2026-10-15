-- Owner edits before publication. Existing generation history and quotas are retained.
begin;
alter table public.challenges add column revision integer not null default 0 check (revision >= 0);

create function public.revise_caption_challenge(
 p_owner uuid, p_challenge uuid, p_revision integer, p_image_id uuid, p_template uuid,
 p_description text, p_context text, p_caption text, p_confirmed boolean, p_manual boolean
) returns uuid language plpgsql security definer set search_path='' as $$
declare
 c public.challenges; image public.challenge_images; next_image_path text; next_template_url text;
 description text := btrim(p_description); context text := nullif(btrim(p_context),'');
 caption text := btrim(p_caption); previous_caption text; source text; scene_changed boolean;
begin
 -- Same ordering as creation and generation claims: owner, challenge, image.
 perform 1 from public.profiles where id=p_owner for update;
 select * into c from public.challenges where id=p_challenge and creator_id=p_owner for update;
 if not found or c.hidden_at is not null or c.status not in ('draft','failed','ready') or c.published_at is not null
  or exists(select 1 from public.challenge_votes where challenge_id=c.id)
  or exists(select 1 from public.challenge_generations where challenge_id=c.id and status='running')
 then raise exception 'Only idle unpublished challenges can be edited'; end if;
 if p_revision is distinct from c.revision then raise exception 'Draft changed; reload before editing' using errcode='40001'; end if;
 if p_confirmed is distinct from true or description is null or char_length(description) not between 1 and 500
  or char_length(coalesce(context,''))>500 or caption is null or char_length(caption) not between 1 and 280
 then raise exception 'Review the description and caption'; end if;
 if (p_image_id is not null)::int + (p_template is not null)::int <> 1 then raise exception 'Choose one image'; end if;
 if p_image_id is not null then
  select * into image from public.challenge_images where id=p_image_id and owner_id=p_owner for update;
  if not found or not image.upload_ready or image.description_status='running'
   or not public.safety_approved(image.moderation_id,p_owner,'image')
   or not exists(select 1 from storage.objects where bucket_id='challenge-images' and name=image.storage_path)
  then raise exception 'Image unavailable for review'; end if;
  next_image_path:=image.storage_path;
 else
  select image_url into next_template_url from public.images where id=p_template;
  if not found or not exists(select 1 from public.challenge_template_reviews r
    where r.template_id=p_template and r.image_url=next_template_url and r.policy_version='moderation-v1')
  then raise exception 'Template requires review'; end if;
 end if;
 source:=case when p_image_id is null then 'template'
  when image.suggested_description is null then 'manual' when p_manual then 'replaced'
  when image.suggested_description=description then 'accepted' else 'edited' end;
 select body into previous_caption from public.challenge_captions where challenge_id=c.id and origin='human';
 if not found then raise exception 'Human caption unavailable'; end if;
 scene_changed:=(c.image_id,c.template_id,c.template_url,c.image_path,c.image_description,c.joke_context)
  is distinct from (p_image_id,p_template,next_template_url,next_image_path,description,context);
 if not scene_changed and previous_caption=caption then return c.id; end if;
 if scene_changed then delete from public.challenge_captions where challenge_id=c.id and origin='ai'; end if;
 update public.challenge_captions set body=caption where challenge_id=c.id and origin='human';
 update public.challenges set image_id=p_image_id,template_id=p_template,template_url=next_template_url,
  image_path=next_image_path,image_description=description,joke_context=context,
  situation=coalesce(context,description),description_source=source,revision=c.revision+1,
  status=case when scene_changed then 'draft' else c.status end,
  human_moderation_id=null,
  asset_moderation_id=case when scene_changed then null else c.asset_moderation_id end,
  ai_moderation_id=case when scene_changed then null else c.ai_moderation_id end
 where id=c.id;
 return c.id;
end $$;
revoke all on function public.revise_caption_challenge(uuid,uuid,integer,uuid,uuid,text,text,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.revise_caption_challenge(uuid,uuid,integer,uuid,uuid,text,text,text,boolean,boolean) to service_role;

-- Close the gap between canonical moderation/prompt preparation and claiming generation.
-- The original service-only claim remains available for existing trusted callers.
create function public.claim_reviewed_caption_generation(
 p_owner uuid,p_challenge uuid,p_revision integer,p_provider text,p_model text,p_prompt jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.challenges;
begin
 perform 1 from public.profiles where id=p_owner for update;
 select * into c from public.challenges where id=p_challenge and creator_id=p_owner for update;
 if not found or p_revision is distinct from c.revision then
  raise exception 'Draft changed; retry generation' using errcode='40001';
 end if;
 return public.claim_caption_generation(p_owner,p_challenge,p_provider,p_model,p_prompt);
end $$;
revoke all on function public.claim_reviewed_caption_generation(uuid,uuid,integer,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.claim_reviewed_caption_generation(uuid,uuid,integer,text,text,jsonb) to service_role;
commit;
