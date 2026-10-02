import SiteHeader from "@/components/site-header";
import { requireUser } from "@/lib/auth";
import { isProfileComplete } from "@/lib/profile";
import { measureOperation } from "@/lib/performance";
import { signAvatars } from "@/lib/avatars";
import ProfileForm from "./profile-form";

export default async function ProfilePage() {
  const { supabase, user } = await requireUser();
  const [{ data: profile, error }, history] = await Promise.all([
    measureOperation("profile.read", () => supabase.from("profiles")
      .select("id, first_name, last_name, avatar_path, favorite_joke").eq("id", user.id).maybeSingle()),
    measureOperation("profile.history", () => supabase.from("profile_avatar_history")
      .select("avatar_path, created_at").eq("profile_id", user.id)
      .order("created_at", { ascending: false }).limit(12)),
  ]);
  const photos = profile && !error && !history.error ? history.data ?? [] : [];
  const signed = await signAvatars(supabase, [
    ...(!error && profile?.avatar_path ? [profile.avatar_path] : []),
    ...photos.map(photo => photo.avatar_path),
  ], "profile.avatars");
  const avatarUrl = profile?.avatar_path ? signed.get(profile.avatar_path) ?? null : null;
  const previousPhotos = photos.flatMap(photo => {
    const url = signed.get(photo.avatar_path);
    return url ? [{ avatarPath: photo.avatar_path, createdAt: photo.created_at, url }] : [];
  });
  return <><SiteHeader /><main className="page-shell account-page">
    <h1>Profile</h1>
    <p className="account-intro">{user.email}</p>
    {error || !profile ? <div role="alert"><p>Your profile couldn’t be loaded. Please try again.</p><a className="button" href="/profile">Reload profile</a></div> : <>
      {!isProfileComplete(profile) && <p className="completion-notice">Complete your profile by adding your first and last name.</p>}
      <ProfileForm key={profile.id} profile={profile} avatarUrl={avatarUrl} previousPhotos={previousPhotos} />
    </>}
  </main></>;
}
