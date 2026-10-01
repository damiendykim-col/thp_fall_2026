"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AVATAR_TYPES, MAX_AVATAR_BYTES, type Profile } from "@/lib/profile";
import { saveProfile, type ProfileResult } from "./actions";

export default function ProfileForm({ profile, avatarUrl }: { profile: Profile; avatarUrl: string | null }) {
  const [result, action, pending] = useActionState<ProfileResult, FormData>(saveProfile, {});
  return <form action={action} className="profile-form">
    {avatarUrl && <div className="profile-photo">
      {/* Signed Supabase URL; no image proxy needed for this private photo. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={avatarUrl} alt="Your profile photo" width={96} height={96} />
    </div>}
    <label>First name<input name="first_name" autoComplete="given-name" defaultValue={profile.first_name ?? ""} maxLength={80} required /></label>
    <label>Last name<input name="last_name" autoComplete="family-name" defaultValue={profile.last_name ?? ""} maxLength={80} required /></label>
    <label>Profile photo<input type="file" name="photo" accept="image/jpeg,image/png,image/webp,image/gif" aria-describedby="photo-help" onChange={(event) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.setCustomValidity(file && (file.size > MAX_AVATAR_BYTES || !AVATAR_TYPES[file.type])
        ? "Choose a JPEG, PNG, WebP, or GIF image no larger than 2 MB." : "");
      event.currentTarget.reportValidity();
    }} /></label>
    <p className="field-help" id="photo-help">Optional. JPEG, PNG, WebP, or GIF, up to 2 MB. Your photo is private.</p>
    {result.error && <p role="alert">{result.error}</p>}
    {result.success && <p role="status">Profile saved. <Link className="confirmation-link" href="/members">Continue to members</Link></p>}
    <button className="button" type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
  </form>;
}
