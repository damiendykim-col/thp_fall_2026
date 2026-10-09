import { authDestination } from "./auth-destination";
import { redirect } from "next/navigation";
import { createAuthClient } from "./supabase/server";
import { isProfileComplete, type Profile } from "./profile";
import { measureOperation } from "./performance";

export async function requireUser(destination?: string) {
  const supabase = await createAuthClient();
  const { data: { user }, error } = await measureOperation("page.auth", () => supabase.auth.getUser());
  if (error || !user) redirect(destination ? `/login?next=${encodeURIComponent(authDestination(destination))}` : "/login");
  return { supabase, user };
}

export async function requireCompleteProfile() {
  const { supabase, user } = await requireUser();
  const { data, error } = await measureOperation("profile.completion", () => supabase.from("profiles")
    .select("id, first_name, last_name").eq("id", user.id).maybeSingle());
  if (error || !isProfileComplete(data)) redirect("/profile");
  return { supabase, user, profile: data as Pick<Profile, "id" | "first_name" | "last_name"> };
}
