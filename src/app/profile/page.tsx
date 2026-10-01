import SiteHeader from "@/components/site-header";
import { requireUser } from "@/lib/auth";
import { isProfileComplete } from "@/lib/profile";
import ProfileForm from "./profile-form";

export default async function ProfilePage() {
  const { supabase, user } = await requireUser();
  const { data: profile, error } = await supabase.from("profiles")
    .select("id, first_name, last_name, avatar_path").eq("id", user.id).maybeSingle();
  let avatarUrl: string | null = null;
  if (profile?.avatar_path) {
    const { data } = await supabase.storage.from("avatars").createSignedUrl(profile.avatar_path, 3600);
    avatarUrl = data?.signedUrl ?? null;
  }
  return <><SiteHeader /><main className="page-shell account-page">
    <h1>Profile</h1>
    <p className="account-intro">{user.email}</p>
    {error || !profile ? <div role="alert"><p>Your profile couldn’t be loaded. Please try again.</p><a className="button" href="/profile">Reload profile</a></div> : <>
      {!isProfileComplete(profile) && <p className="completion-notice">Complete your profile by adding your first and last name.</p>}
      <ProfileForm profile={profile} avatarUrl={avatarUrl} />
    </>}
  </main></>;
}
