import SiteHeader from "@/components/site-header";
import { requireUser } from "@/lib/auth";
import { isProfileComplete } from "@/lib/profile";
import { measureOperation } from "@/lib/performance";
import ProfileForm from "./profile-form";

export default async function ProfilePage() {
  const { supabase, user } = await requireUser();
  const { data: profile, error } = await measureOperation("profile.read", () => supabase.from("profiles")
    .select("id, first_name, last_name, avatar_path, favorite_joke").eq("id", user.id).maybeSingle());
  let avatarUrl: string | null = null;
  if (profile?.avatar_path) {
    const { data } = await measureOperation("profile.avatar", () => supabase.storage.from("avatars").createSignedUrl(profile.avatar_path, 3600));
    avatarUrl = data?.signedUrl ?? null;
  }
  const previousPhotos = !profile ? [] : await measureOperation("profile.history", () => supabase.from("profile_avatar_history")
    .select("avatar_path, created_at")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    .limit(12))
    .then(async ({ data, error: historyError }) => {
      if (historyError || !data) return [];
      const signed = await Promise.all(data.map(async ({ avatar_path, created_at }) => {
        const { data: signedData } = await measureOperation("profile.history-avatar", () => supabase.storage.from("avatars").createSignedUrl(avatar_path, 3600));
        return signedData?.signedUrl ? { avatarPath: avatar_path, createdAt: created_at, url: signedData.signedUrl } : null;
      }));
      return signed.filter((photo): photo is { avatarPath: string; createdAt: string; url: string } => Boolean(photo));
    });
  return <><SiteHeader /><main className="page-shell account-page">
    <h1>Profile</h1>
    <p className="account-intro">{user.email}</p>
    {error || !profile ? <div role="alert"><p>Your profile couldn’t be loaded. Please try again.</p><a className="button" href="/profile">Reload profile</a></div> : <>
      {!isProfileComplete(profile) && <p className="completion-notice">Complete your profile by adding your first and last name.</p>}
      <ProfileForm profile={profile} avatarUrl={avatarUrl} previousPhotos={previousPhotos} />
    </>}
  </main></>;
}
