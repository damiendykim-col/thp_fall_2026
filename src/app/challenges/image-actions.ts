"use server";

import { createHash } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { challengeAdmin, normalizeChallengeImage } from "@/lib/challenges/server";
import { descriptionPrompt, generateDescription, generationConfig } from "@/lib/challenges/generation";

import { ensureModerated, moderationMessage } from "@/lib/challenges/moderation";

export type ImageReviewResult = {
  id?: string;
  description?: string;
  error?: string;
};

export async function uploadChallengeImage(form: FormData): Promise<ImageReviewResult> {
  const { user } = await requireUser();
  const file = form.get("image");
  if (!(file instanceof File) || !file.size) return { error: "Choose an image first." };
  let bytes: Buffer;
  try {
    bytes = await normalizeChallengeImage(file);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The image could not be read." };
  }
  try {
    const admin = challengeAdmin();
    // An owner-scoped content hash makes upload retries reuse the image and its analysis.
    // The reservation RPC serializes quota checks before either storage or provider work.
    const { data: image, error } = await admin.rpc("reserve_challenge_image", {
      p_owner: user.id, p_hash: createHash("sha256").update(bytes).digest("hex"),
    });
    if (error || !image) return { error: "Unable to prepare image. Check the migration and daily limit of 10 images." };
    const moderationId = await ensureModerated(user.id, "image", "Check this uploaded image.", bytes);
    const { error: moderationError } = await admin.from("challenge_images").update({ moderation_id: moderationId }).eq("id", image.id).eq("owner_id", user.id);
    if (moderationError) return { error: "The safety result could not be saved. Please retry." };
    if (!image.upload_ready) {
      const { error: uploadError } = await admin.storage.from("challenge-images").upload(image.storage_path, bytes, {
        contentType: "image/jpeg", cacheControl: "3600", upsert: false,
      });
      // A concurrent retry can have uploaded these same normalized bytes first.
      if (uploadError && String(uploadError.statusCode) !== "409") return { error: "The image could not be uploaded. Please retry." };
      const { error: readyError } = await admin.from("challenge_images").update({ upload_ready: true }).eq("id", image.id).eq("owner_id", user.id);
      if (readyError) return { error: "The upload could not be finalized. Please retry." };
    }
    return { id: image.id };
  } catch (error) {
    return { error: moderationMessage(error) };
  }
}

export async function suggestImageDescription(id: string): Promise<ImageReviewResult> {
  const { user } = await requireUser();
  const fallback = { id, error: "A description could not be suggested. Write your own to continue." };
  const admin = challengeAdmin();
  const { data: image, error } = await admin.from("challenge_images").select("*").eq("id", id).eq("owner_id", user.id).single();
  if (error || !image?.upload_ready) return { error: "Image unavailable." };
  const { data: safe, error: safetyError } = await admin.rpc("safety_approved", { p_check: image.moderation_id, p_owner: user.id, p_phase: "image" });
  if (safetyError || !safe) return { error: "The image must pass safety checking before description or manual review. Retry this image." };
  if (image.description_status === "succeeded") return { id, description: image.suggested_description };
  if (image.description_status === "failed" || image.confirmed_description) return fallback;
  if (image.description_status === "running") {
    // Interrupted work may fall back to manual review. A late completion is ignored.
    const { data: expired } = await admin.from("challenge_images").update({ description_status: "failed" })
      .eq("id", id).eq("description_status", "running")
      .lt("description_started_at", new Date(Date.now() - 120_000).toISOString()).select("id").maybeSingle();
    return expired ? fallback : { error: "Description is already being generated. Retry this image after two minutes if the request was interrupted." };
  }
  const prompt = descriptionPrompt(image.storage_path);
  try {
    const config = generationConfig();
    const { data: claimed, error: claimError } = await admin.from("challenge_images").update({
      description_status: "running", description_started_at: new Date().toISOString(),
      provider: config.provider, model: config.model, prompt,
    }).eq("id", id).eq("description_status", "pending").is("confirmed_description", null).select("id").maybeSingle();
    if (claimError || !claimed) return { error: "Description is already being generated. Retry this image to check its status." };
    const { data: file, error: downloadError } = await admin.storage.from("challenge-images").download(image.storage_path);
    if (downloadError || !file) throw new Error("Image unavailable");
    const description = await generateDescription(config, prompt, Buffer.from(await file.arrayBuffer()));
    const { data: saved, error: saveError } = await admin.from("challenge_images").update({
      suggested_description: description, description_status: "succeeded",
    }).eq("id", id).eq("description_status", "running").is("confirmed_description", null).select("id").maybeSingle();
    if (saveError || !saved) throw new Error("Description could not be saved");
    return { id, description };
  } catch {
    await admin.from("challenge_images").update({ description_status: "failed" })
      .eq("id", id).in("description_status", ["pending", "running"]).is("confirmed_description", null);
    return fallback;
  }
}
