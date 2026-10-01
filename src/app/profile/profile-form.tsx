"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AVATAR_TYPES, MAX_AVATAR_BYTES, MAX_FAVORITE_JOKE_CHARS, type Profile } from "@/lib/profile";
import { saveProfile, type ProfileResult } from "./actions";

type PreviousPhoto = { avatarPath: string; createdAt: string; url: string };

export default function ProfileForm({
  profile,
  avatarUrl,
  previousPhotos,
}: {
  profile: Profile;
  avatarUrl: string | null;
  previousPhotos: PreviousPhoto[];
}) {
  const [result, action, pending] = useActionState<ProfileResult, FormData>(saveProfile, {});
  return <form action={action} className="profile-form">
    {avatarUrl && <div className="profile-photo">
      {/* Signed Supabase URL; no image proxy needed for this private photo. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={avatarUrl} alt="Your profile photo" width={96} height={96} />
    </div>}
    <label>First name<input name="first_name" autoComplete="given-name" defaultValue={profile.first_name ?? ""} maxLength={80} required /></label>
    <label>Last name<input name="last_name" autoComplete="family-name" defaultValue={profile.last_name ?? ""} maxLength={80} required /></label>
    <label>Favorite joke<textarea name="favorite_joke" defaultValue={profile.favorite_joke ?? ""} maxLength={MAX_FAVORITE_JOKE_CHARS} aria-describedby="favorite-joke-help" /></label>
    <p className="field-help" id="favorite-joke-help">Optional. Up to {MAX_FAVORITE_JOKE_CHARS} characters.</p>
    <label>Profile photo<input type="file" name="photo" accept="image/jpeg,image/png,image/webp,image/gif" aria-describedby="photo-help" onChange={(event) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.setCustomValidity(file && (file.size > MAX_AVATAR_BYTES || !AVATAR_TYPES[file.type])
        ? "Choose a JPEG, PNG, WebP, or GIF image no larger than 2 MB." : "");
      event.currentTarget.reportValidity();
    }} /></label>
    <p className="field-help" id="photo-help">Optional. JPEG, PNG, WebP, or GIF, up to 2 MB. Your current photo is visible to members.</p>
    {previousPhotos.length > 0 && <section className="avatar-history">
      <h2>Previous profile photos</h2>
      <ul className="avatar-history-list">
        {previousPhotos.map((photo) => <li key={photo.avatarPath}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt={`Previous profile photo from ${new Date(photo.createdAt).toLocaleDateString()}`} width={64} height={64} />
        </li>)}
      </ul>
    </section>}
    {result.error && <p role="alert">{result.error}</p>}
    {result.success && <p role="status">Profile saved. <Link className="confirmation-link" href="/members">Continue to members</Link></p>}
    <button className="button" type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
  </form>;
}
