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
  if (selected && !selected.startsWith(`${user.id}/`)) {
    return { error: "That photo is not in your collection." };
  }
  let newPath: string | undefined;
  if (file) {
    newPath = `${user.id}/${crypto.randomUUID()}.${AVATAR_TYPES[file.type]}`;
    const { error } = await supabase.storage.from("avatars").upload(newPath, file, { contentType: file.type, upsert: false });
    if (error) return { error: "Your photo couldn’t be uploaded. Please try again." };
  }
  // The database validates photo ownership and saves all fields in one transaction.
  // No caller-supplied user ID; the RPC resolves ownership from auth.uid().
  const { data: saved, error } = await supabase.rpc("save_my_profile", {
    p_first_name: (first as string).trim(),
    p_last_name: (last as string).trim(),
    p_favorite_joke: favoriteJokeText || null,
    p_avatar_path: newPath || selected || null,
    p_avatar_is_upload: Boolean(newPath),
  });
  if (error || saved !== user.id) {
    // Only a definite database rejection proves the upload was not committed.
    // A lost response may follow a successful commit; never delete that photo.
    if (newPath && error && ["22023", "23503", "23514", "42501", "P0001"].includes(error.code)) {
      await supabase.storage.from("avatars").remove([newPath]);
    }
    return { error: "Your profile couldn’t be saved. Please reload to check your changes before trying again." };
  }
  revalidatePath("/profile");
  revalidatePath("/members");
  return { success: true };
}
