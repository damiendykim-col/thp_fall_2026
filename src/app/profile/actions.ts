"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { AVATAR_TYPES, MAX_AVATAR_BYTES, validateFavoriteJoke, validateNames } from "@/lib/profile";

export type ProfileResult = { error?: string; success?: boolean };

export async function saveProfile(_previous: ProfileResult, form: FormData): Promise<ProfileResult> {
  const { supabase, user } = await requireUser();
  const first = form.get("first_name");
  const last = form.get("last_name");
  const invalid = validateNames(first, last);
  if (invalid) return { error: invalid };
  const favoriteJoke = form.get("favorite_joke");
  const invalidJoke = validateFavoriteJoke(favoriteJoke);
  if (invalidJoke) return { error: invalidJoke };
  const favoriteJokeText = typeof favoriteJoke === "string" ? favoriteJoke.trim() : "";
  const photo = form.get("photo");
  const file = photo instanceof File && photo.size > 0 ? photo : null;
  if (file && (file.size > MAX_AVATAR_BYTES || !AVATAR_TYPES[file.type])) {
    return { error: "Choose a JPEG, PNG, WebP, or GIF image no larger than 2 MB." };
  }
  const selection = form.get("previous_avatar");
  if (selection !== null && typeof selection !== "string") return { error: "Choose a valid previous photo." };
  const selected = typeof selection === "string" ? selection : "";
  if (file && selected) return { error: "Choose either a new upload or a previous photo." };
  if (selected) {
    if (!selected.startsWith(`${user.id}/`)) return { error: "That photo is not in your history." };
    const { data: owned, error: historyError } = await supabase.from("profile_avatar_history")
      .select("avatar_path").eq("profile_id", user.id).eq("avatar_path", selected).maybeSingle();
    if (historyError || !owned) return { error: "That photo is not in your history." };
  }
  const { data: current, error: readError } = await supabase.from("profiles")
    .select("avatar_path").eq("id", user.id).single();
  if (readError || !current) return { error: "Your profile couldn’t be loaded. Please try again." };
  let newPath: string | undefined;
  if (file) {
    newPath = `${user.id}/${crypto.randomUUID()}.${AVATAR_TYPES[file.type]}`;
    const { error } = await supabase.storage.from("avatars").upload(newPath, file, { contentType: file.type, upsert: false });
    if (error) return { error: "Your photo couldn’t be uploaded. Please try again." };
  }
  const nextPath = newPath || selected;
  if (nextPath && current.avatar_path && nextPath !== current.avatar_path && current.avatar_path.startsWith(`${user.id}/`)) {
    const { error: historyError } = await supabase.from("profile_avatar_history").insert({
      profile_id: user.id, avatar_path: current.avatar_path,
    });
    // A previously restored photo may already be in history. Keep one entry.
    if (historyError && historyError.code !== "23505") {
      if (newPath) await supabase.storage.from("avatars").remove([newPath]);
      return { error: "Your photo history couldn’t be saved. Please try again." };
    }
  }
  const { data: saved, error } = await supabase.from("profiles").update({
    first_name: (first as string).trim(),
    last_name: (last as string).trim(),
    favorite_joke: favoriteJokeText || null,
    ...(nextPath ? { avatar_path: nextPath } : {}),
  }).eq("id", user.id).select("id").single();
  if (error || !saved) {
    if (newPath) await supabase.storage.from("avatars").remove([newPath]);
    return { error: "Your profile couldn’t be saved. Please try again." };
  }
  revalidatePath("/profile");
  revalidatePath("/members");
  return { success: true };
}
