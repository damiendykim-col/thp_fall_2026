import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/site-header";
import SignIn from "./sign-in";

export default async function LoginPage() {
  const supabase = await createAuthClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/profile");
  return <><SiteHeader /><main className="page-shell account-page"><h1>Sign in</h1><p className="account-intro">Use your Google account to access your profile and the members page.</p><SignIn /></main></>;
}
