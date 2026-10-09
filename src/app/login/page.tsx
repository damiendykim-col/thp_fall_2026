import { authDestination } from "@/lib/auth-destination";
import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import SignIn from "./sign-in";
import TestSignIn from "./test-sign-in";
import { isTestAuthEnabled } from "@/lib/test-auth-config";
import { measureOperation } from "@/lib/performance";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = (await searchParams).next;
  const destination = authDestination(next);
  const supabase = await createAuthClient();
  const { data: { user } } = await measureOperation("login.auth", () => supabase.auth.getUser());
  if (user) redirect(destination);
  return <><SiteHeader /><main className="page-shell account-page"><h1>Sign in</h1><p className="account-intro">Sign in to vote, create a challenge, and see how your caption fares.</p><SignIn destination={destination} />{isTestAuthEnabled() && <TestSignIn destination={next ? destination : undefined} />}</main></>;
}
