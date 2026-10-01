"use server";

import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw new Error("Couldn’t sign out. Please try again.");
  redirect("/login");
}
