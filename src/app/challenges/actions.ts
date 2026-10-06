"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { challengeAdmin, normalizeChallengeImage } from "@/lib/challenges/server";
import { captionPrompt, generateCaption, generationConfig } from "@/lib/challenges/generation";
import type { ChallengeResult } from "@/lib/challenges/types";

export async function createChallenge(_: ChallengeResult, form: FormData): Promise<ChallengeResult> {
  const { user } = await requireUser();
  const situation = String(form.get("situation") ?? "").trim();
  const caption = String(form.get("caption") ?? "").trim();
  const template = String(form.get("template") ?? "");
  const file = form.get("image");
  if (!situation || situation.length > 500 || !caption || caption.length > 280) return { error: "Add a situation (up to 500 characters) and caption (up to 280)." };
  let path: string | null = null;
  try {
    const admin = challengeAdmin();
    // Bound uploads before accepting bytes into storage. The RPC enforces the quota again atomically.
    const { count, error: quotaError } = await admin.from("challenges").select("id", { count: "exact", head: true }).eq("creator_id", user.id).gte("created_at", new Date(Date.now()-86400000).toISOString());
    if (quotaError) return { error: "Challenges are not available yet. Check the database migration." };
    if ((count ?? 0) >= 10) return { error: "Daily challenge limit reached. Try again tomorrow." };
    if (file instanceof File && file.size) {
      if (template) return { error: "Choose either an upload or a gallery template." };
      const image = await normalizeChallengeImage(file);
      path = `${user.id}/${randomUUID()}.jpg`;
      const { error } = await admin.storage.from("challenge-images").upload(path, image, { contentType: "image/jpeg", cacheControl: "3600", upsert: false });
      if (error) return { error: "The image could not be uploaded. Please try again." };
    } else if (!template) return { error: "Choose an image first." };
    const { data, error } = await admin.rpc("create_caption_challenge", { p_owner: user.id, p_image: path, p_template: template || null, p_situation: situation, p_caption: caption });
    if (error) {
      if (path) await admin.storage.from("challenge-images").remove([path]);
      return { error: "The draft could not be saved. Check the image and your daily limit." };
    }
    revalidatePath("/challenges");
    return { id: data };
  } catch (e) { return { error: e instanceof Error ? e.message : "Unable to create challenge." }; }
}
export async function generateOpponent(id: string): Promise<ChallengeResult> {
  const { user } = await requireUser();
  let request: string | undefined;
  try {
    const config = generationConfig();
    const admin = challengeAdmin();
    const { data: challenge, error } = await admin.from("challenges").select("situation,image_path").eq("id", id).eq("creator_id", user.id).single();
    if (error || !challenge) return { error: "Challenge unavailable." };
    const prompt = captionPrompt(challenge.situation, challenge.image_path);
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
