"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { challengeAdmin } from "@/lib/challenges/server";
import { captionPrompt, generateCaption, generationConfig } from "@/lib/challenges/generation";
import { ensureModerated, humanReviewText, moderationMessage, ModerationError, requireTemplateReview, reviewChallenge } from "@/lib/challenges/moderation";
import type { ChallengeResult } from "@/lib/challenges/types";

export async function createChallenge(_: ChallengeResult, form: FormData): Promise<ChallengeResult> {
  const { user } = await requireUser();
  const description = String(form.get("description") ?? "").trim();
  const context = String(form.get("context") ?? "").trim();
  const caption = String(form.get("caption") ?? "").trim();
  const imageId = String(form.get("imageId") ?? "");
  const template = String(form.get("template") ?? "");
  if (form.get("confirmed") !== "on" || !description || description.length > 500) {
    return { error: "Review and confirm an image description of up to 500 characters." };
  }
  if (context.length > 500 || !caption || caption.length > 280) {
    return { error: "Keep joke context within 500 characters and add a caption of up to 280." };
  }
  if (Boolean(imageId) === Boolean(template)) return { error: "Choose one uploaded image or template." };
  try {
    const admin = challengeAdmin();
    let imageBytes: Buffer | undefined;
    if (imageId) {
      const { data: image } = await admin.from("challenge_images").select("storage_path,moderation_id,upload_ready").eq("id", imageId).eq("owner_id", user.id).single();
      if (!image?.upload_ready) throw new ModerationError("Image unavailable.");
      const { data: safe } = await admin.rpc("safety_approved", { p_check: image.moderation_id, p_owner: user.id, p_phase: "image" });
      if (!safe) throw new ModerationError("The image must pass safety checking first.");
      const { data: file, error: downloadError } = await admin.storage.from("challenge-images").download(image.storage_path);
      if (downloadError || !file) throw new ModerationError("The image could not be checked. Please retry.");
      imageBytes = Buffer.from(await file.arrayBuffer());
    } else await requireTemplateReview(template);
    await ensureModerated(user.id, "human", humanReviewText(description, context, caption), imageBytes);
    const { data, error } = await admin.rpc("create_reviewed_challenge", {
      p_owner: user.id, p_image_id: imageId || null, p_template: template || null,
      p_description: description, p_context: context, p_caption: caption,
      p_submission: String(form.get("submission") ?? ""),
      p_confirmed: true, p_manual: form.get("manual") === "true",
    });
    if (error) return { error: "The draft could not be saved. Check the image and your daily limit." };
    // The submission ID may refer to an earlier successful request. Bind approval
    // to its canonical stored content, never to replacement form fields.
    await reviewChallenge(user.id, data, false);
    revalidatePath("/challenges");
    return { id: data };
  } catch (error) {
    return { error: moderationMessage(error) };
  }
}

export async function generateOpponent(id: string): Promise<ChallengeResult> {
  const { user } = await requireUser();
  let request: string | undefined;
  try {
    const config = generationConfig();
    const admin = challengeAdmin();
    const { challenge, bytes, frames } = await reviewChallenge(user.id, id, false);
    const prompt = captionPrompt(
      challenge.image_description ? challenge.joke_context ?? "" : challenge.situation,
      challenge.image_path, challenge.image_description ?? undefined, frames,
    );
    const { data, error: claimError } = await admin.rpc("claim_caption_generation", { p_owner: user.id, p_challenge: id, p_provider: config.provider, p_model: config.model, p_prompt: prompt });
    if (claimError) {
      // Log the operation and SQLSTATE only, never prompts or provider payloads.
      console.error("claim_caption_generation failed", { code: claimError.code });
      return { error: claimError.code === "P0001"
        ? "Generation is already running, complete, or at its limit. Interrupted requests can be retried after two minutes."
        : "Generation could not start because of a backend error. Please try again later." };
    }
    request = data;
    const caption = await generateCaption(config, prompt, bytes);
    const aiCheck = await ensureModerated(user.id, "ai", humanReviewText(
      challenge.image_description || challenge.situation,
      challenge.image_description ? challenge.joke_context || "" : "", caption,
    ), bytes);
    const { error: saveError } = await admin.rpc("finish_caption_generation", { p_request: request, p_caption: caption });
    if (saveError) {
      console.error("finish_caption_generation failed", { code: saveError.code });
      throw new Error("The caption could not be saved. Please retry.");
    }
    const { error: approvalError } = await admin.from("challenges").update({ ai_moderation_id: aiCheck }).eq("id", id).eq("creator_id", user.id);
    if (approvalError) throw new Error("The safety result could not be saved. Please retry publication.");
    revalidatePath(`/challenges/${id}`);
    return {};
  } catch (e) {
    if (request) await challengeAdmin().rpc("finish_caption_generation", { p_request: request, p_caption: null });
    revalidatePath(`/challenges/${id}`);
    return { error: e instanceof Error && e.name !== "TimeoutError" ? e.message : "Generation timed out. Please retry." };
  }
}
export async function publishChallenge(id: string): Promise<ChallengeResult> {
  const { supabase, user } = await requireUser();
  try {
    const { data: row } = await supabase.from("challenges").select("image_id,image_path").eq("id",id).eq("creator_id",user.id).single();
    if (row?.image_path?.endsWith(".gif")) {
      const { data: image } = await supabase.from("challenge_images").select("animation_review").eq("id",row.image_id).single();
      if (image?.animation_review !== "approved") return { error: image?.animation_review === "rejected" ? "This GIF was rejected by a moderator. Start a revised challenge with a different image." : "The full GIF is awaiting moderator review. You can publish after approval." };
    }
    await reviewChallenge(user.id, id, true);
    const { error } = await supabase.rpc("publish_caption_challenge", { p_challenge: id });
    if (error) return { error: "Publication requires approved content and both captions. Hidden challenges cannot be republished." };
    revalidatePath("/challenges", "layout");
    return {};
  } catch (error) { return { error: moderationMessage(error) }; }
}
export async function voteChallenge(id: string, caption: string | null): Promise<ChallengeResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("vote_caption_challenge", { p_challenge: id, p_caption: caption });
  revalidatePath(`/challenges/${id}`);
  return error ? { error: "Your vote could not be saved. Voting may have closed; creators cannot vote on their own challenge." } : {};
}
