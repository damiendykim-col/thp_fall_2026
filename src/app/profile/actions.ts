"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { AVATAR_TYPES, MAX_AVATAR_BYTES, validateNames } from "@/lib/profile";

export type ProfileResult = { error?: string; success?: boolean };

export async function saveProfile(_previous: ProfileResult, form: FormData): Promise<ProfileResult> {
  const { supabase, user } = await requireUser();
  const first = form.get("first_name");
  const last = form.get("last_name");
  const invalid = validateNames(first, last);
  if (invalid) return { error: invalid };
  const photo = form.get("photo");
  const file = photo instanceof File && photo.size > 0 ? photo : null;
  if (file && (file.size > MAX_AVATAR_BYTES || !AVATAR_TYPES[file.type])) {
    return { error: "Choose a JPEG, PNG, WebP, or GIF image no larger than 2 MB." };
  }
  const { data: current, error: readError } = await supabase.from("profiles")
    .select("avatar_path").eq("id", user.id).single();
  if (readError) return { error: "Your profile couldn’t be loaded. Please try again." };
  let newPath: string | undefined;
  if (file) {
    newPath = `${user.id}/${crypto.randomUUID()}.${AVATAR_TYPES[file.type]}`;
    const { error } = await supabase.storage.from("avatars").upload(newPath, file, { contentType: file.type, upsert: false });
    if (error) return { error: "Your photo couldn’t be uploaded. Please try again." };
  }
  const { data: saved, error } = await supabase.from("profiles").update({
    first_name: (first as string).trim(),
    last_name: (last as string).trim(),
    ...(newPath ? { avatar_path: newPath } : {}),
  }).eq("id", user.id).select("id").single();
  if (error || !saved) {
    if (newPath) await supabase.storage.from("avatars").remove([newPath]);
    return { error: "Your profile couldn’t be saved. Please try again." };
  }
  if (newPath && current.avatar_path && current.avatar_path.startsWith(`${user.id}/`)) {
    await supabase.storage.from("avatars").remove([current.avatar_path]);
  }
  revalidatePath("/profile");
  revalidatePath("/members");
  return { success: true };
}
