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
      .select("id, first_name, last_name, member_profiles(current_avatar_path, favorite_joke)").eq("id", user.id).maybeSingle()),
    measureOperation("profile.history", () => supabase.from("profile_photos")
      .select("avatar_path, created_at").eq("profile_id", user.id)
      .order("created_at", { ascending: false }).limit(12)),
  ]);
  const presentation = profile?.member_profiles;
  // This is a one-to-one relationship (member_profiles.profile_id is its PK).
  // Fail visibly if the signup/backfill row is missing rather than saving blanks.
  const member = Array.isArray(presentation) ? presentation[0] : presentation;
  const formProfile = profile && member ? {
    id: profile.id, first_name: profile.first_name, last_name: profile.last_name,
    avatar_path: member.current_avatar_path, favorite_joke: member.favorite_joke,
  } : null;
  const photos = profile && !error && !history.error ? history.data ?? [] : [];
  const signed = await signAvatars(supabase, [
    ...(!error && formProfile?.avatar_path ? [formProfile.avatar_path] : []),
    ...photos.map(photo => photo.avatar_path),
  ], "profile.avatars");
  const avatarUrl = formProfile?.avatar_path ? signed.get(formProfile.avatar_path) ?? null : null;
  const previousPhotos = photos.flatMap(photo => {
    const url = signed.get(photo.avatar_path);
    return url ? [{ avatarPath: photo.avatar_path, createdAt: photo.created_at, url }] : [];
  });
  return <><SiteHeader /><main className="page-shell account-page">
    <h1>Profile</h1>
    <p className="account-intro">{user.email}</p>
    {error || !formProfile ? <div role="alert"><p>Your profile couldn’t be loaded. Please try again.</p><a className="button" href="/profile">Reload profile</a></div> : <>
      {!isProfileComplete(formProfile) && <p className="completion-notice">Complete your profile by adding your first and last name.</p>}
      <ProfileForm key={formProfile.id} profile={formProfile} avatarUrl={avatarUrl} previousPhotos={previousPhotos} />
    </>}
  </main></>;
}
