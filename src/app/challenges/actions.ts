"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { challengeAdmin } from "@/lib/challenges/server";
import { captionPrompt, generateCaption, generationConfig } from "@/lib/challenges/generation";
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
    const { data, error } = await challengeAdmin().rpc("create_reviewed_challenge", {
      p_owner: user.id, p_image_id: imageId || null, p_template: template || null,
      p_description: description, p_context: context, p_caption: caption,
      p_submission: String(form.get("submission") ?? ""),
      p_confirmed: true, p_manual: form.get("manual") === "true",
    });
    if (error) return { error: "The draft could not be saved. Check the image and your daily limit." };
    revalidatePath("/challenges");
    return { id: data };
  } catch {
    return { error: "Unable to create challenge. Your uploaded image can be reused when you retry." };
  }
}

export async function generateOpponent(id: string): Promise<ChallengeResult> {
  const { user } = await requireUser();
  let request: string | undefined;
  try {
    const config = generationConfig();
    const admin = challengeAdmin();
    const { data: challenge, error } = await admin.from("challenges").select("situation,image_path,image_description,joke_context").eq("id", id).eq("creator_id", user.id).single();
    if (error || !challenge) return { error: "Challenge unavailable." };
    const prompt = captionPrompt(
      challenge.image_description ? challenge.joke_context ?? "" : challenge.situation,
      challenge.image_path, challenge.image_description ?? undefined,
    );
    const { data, error: claimError } = await admin.rpc("claim_caption_generation", { p_owner: user.id, p_challenge: id, p_provider: config.provider, p_model: config.model, p_prompt: prompt });
    if (claimError) return { error: "Generation is already running, complete, or at its limit. Interrupted requests can be retried after two minutes." };
    request = data;
    let bytes: Buffer | undefined;
    if (challenge.image_path) {
      const { data: image, error: downloadError } = await admin.storage.from("challenge-images").download(challenge.image_path);
      if (downloadError || !image) throw new Error("The saved image could not be loaded. Please retry.");
      bytes = Buffer.from(await image.arrayBuffer());
    }
    const caption = await generateCaption(config, prompt, bytes);
    const { error: saveError } = await admin.rpc("finish_caption_generation", { p_request: request, p_caption: caption });
    if (saveError) throw new Error("The caption could not be saved. Please retry.");
    revalidatePath(`/challenges/${id}`);
    return {};
  } catch (e) {
    if (request) await challengeAdmin().rpc("finish_caption_generation", { p_request: request, p_caption: null });
    revalidatePath(`/challenges/${id}`);
    return { error: e instanceof Error && e.name !== "TimeoutError" ? e.message : "Generation timed out. Please retry." };
  }
}
export async function publishChallenge(id: string): Promise<ChallengeResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("publish_caption_challenge", { p_challenge: id });
  if (error) return { error: "The challenge could not be published. Generate the opponent first." };
  revalidatePath("/challenges", "layout");
  return {};
}
export async function voteChallenge(id: string, caption: string | null): Promise<ChallengeResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("vote_caption_challenge", { p_challenge: id, p_caption: caption });
  revalidatePath(`/challenges/${id}`);
  return error ? { error: "Your vote could not be saved. Voting may have closed; creators cannot vote on their own challenge." } : {};
}
