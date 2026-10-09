"use server";

import { isProfileComplete } from "@/lib/profile";
import { authDestination } from "@/lib/auth-destination";
import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/server";
import { isTestAuthEnabled } from "@/lib/test-auth-config";

export async function testSignIn(_previous: { error?: string }, form: FormData): Promise<{ error?: string }> {
  // Check here, not just in the UI: server actions can be called directly.
  if (!isTestAuthEnabled()) return { error: "Test sign-in is unavailable." };
  const email = form.get("email");
  const password = form.get("password");
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return { error: "Enter your local test email and password." };
  }
  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Test sign-in failed. Check your local test credentials." };
  if (form.get("next") && data?.user) {
    const { data: profile } = await supabase.from("profiles").select("first_name,last_name").eq("id", data.user.id).maybeSingle();
    if (isProfileComplete(profile)) redirect(authDestination(form.get("next")));
  }
  redirect(form.get("next") ? `/profile?next=${encodeURIComponent(authDestination(form.get("next")))}` : "/profile");
}
