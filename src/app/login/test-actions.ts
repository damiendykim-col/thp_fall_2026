"use server";

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
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Test sign-in failed. Check your local test credentials." };
  redirect("/profile");
}
