import { logOperation } from "@/lib/operation-log";
import { cookies } from "next/headers";
import { authDestination } from "@/lib/auth-destination";
import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { isProfileComplete } from "@/lib/profile";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const returnTo = authDestination(jar.get("auth-return")?.value);
  const code = url.searchParams.get("code");
  let destination = "/auth/error";
  if (code && !url.searchParams.has("error")) {
    try {
      const supabase = await createAuthClient({ writableCookies: true });
      const flowId = url.searchParams.get('sb_flow_id');
      // Let the SDK validate the identifier and select only that flow's verifier.
      const { data, error } = flowId !== null
        ? await supabase.auth.exchangeCodeForSession(code, { flowId })
        : await supabase.auth.exchangeCodeForSession(code);
      if (!error && data.user) {
        logOperation("auth.exchange", "succeeded");
        jar.delete("auth-return");
        const { data: profile, error: profileError } = await supabase.from("profiles")
          .select("first_name, last_name").eq("id", data.user.id).maybeSingle();
        if (profileError) logOperation("auth.profile", "failed", profileError);
        destination = isProfileComplete(profile) ? returnTo : `/profile?next=${encodeURIComponent(returnTo)}`;
      } else logOperation("auth.exchange", "failed", error);
    } catch (error) {
      logOperation("auth.callback", "failed", error);
    }
  } else logOperation("auth.callback", "rejected");
  // Fixed internal destinations only; no user-supplied redirect parameters.
  const response = NextResponse.redirect(new URL(destination, url.origin));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
