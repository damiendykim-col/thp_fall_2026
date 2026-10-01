import { redirect } from "next/navigation";
import { createAuthClient } from "./supabase/server";
import { isProfileComplete, type Profile } from "./profile";

export async function requireUser() {
  const supabase = await createAuthClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  return { supabase, user };
}

export async function requireCompleteProfile() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("profiles")
    .select("id, first_name, last_name, avatar_path").eq("id", user.id).maybeSingle();
  if (error || !isProfileComplete(data)) redirect("/profile");
  return { supabase, user, profile: data as Profile };
}
