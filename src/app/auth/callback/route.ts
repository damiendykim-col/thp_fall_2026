import { cookies } from "next/headers";
import { authDestination } from "@/lib/auth-destination";
import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { isProfileComplete } from "@/lib/profile";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const returnTo = authDestination(jar.get("auth-return")?.value);
  jar.delete("auth-return");
  const code = url.searchParams.get("code");
  let destination = "/auth/error";
  if (code && !url.searchParams.has("error")) {
    const supabase = await createAuthClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const { data: profile } = await supabase.from("profiles")
        .select("first_name, last_name").eq("id", data.user.id).maybeSingle();
      destination = isProfileComplete(profile) ? returnTo : `/profile?next=${encodeURIComponent(returnTo)}`;
    }
  }
  // Fixed internal destinations only; no user-supplied redirect parameters.
  const response = NextResponse.redirect(new URL(destination, url.origin));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
