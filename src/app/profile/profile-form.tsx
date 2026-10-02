"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { AVATAR_TYPES, MAX_AVATAR_BYTES, MAX_FAVORITE_JOKE_CHARS, type Profile } from "@/lib/profile";
import { readDraft, writeDraft, type ProfileDraft } from "@/lib/profile-draft";
import { saveProfile, type ProfileResult } from "./actions";

type PreviousPhoto = { avatarPath: string; createdAt: string; url: string };
export default function ProfileForm({ profile, avatarUrl, previousPhotos }: {
  profile: Profile; avatarUrl: string | null; previousPhotos: PreviousPhoto[];
}) {
  const initial = (): ProfileDraft => ({ first: profile.first_name ?? "", last: profile.last_name ?? "", joke: profile.favorite_joke ?? "", previous: "", needsFile: false });
  const [draft, setDraft] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const localFile = useRef<File | null>(null);
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const saved = readDraft(profile.id);
    if (!saved) return;
    const missing = saved.previous && saved.previous !== profile.avatar_path && !previousPhotos.some(p => p.avatarPath === saved.previous);
    if (missing || saved.previous === profile.avatar_path) saved.previous = "";
    // Restore once after hydration; subsequent server renders must not overwrite edits.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(saved);
    setDirty(true);
    setNotice(`Unsaved changes restored.${saved.needsFile ? " Please select your local photo again; it was not saved in this browser." : ""}${missing ? " The selected previous photo is unavailable. Please choose another." : ""}`);
  }, [profile.id, profile.avatar_path, previousPhotos]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  function change(next: ProfileDraft) {
    setDraft(next); setDirty(true); setNotice(""); writeDraft(profile.id, next);
  }
  function resetFile() {
    localFile.current = null;
    if (fileInput.current) { fileInput.current.value = ""; fileInput.current.setCustomValidity(""); }
    setPreview(null);
  }
  function cancelPhoto() {
    resetFile(); change({ ...draft, previous: "", needsFile: false });
  }
  const [result, action, pending] = useActionState<ProfileResult, FormData>(async (previous, data) => {
    if (localFile.current) data.set("photo", localFile.current);
    const saved = await saveProfile(previous, data);
    if (saved.success) {
      writeDraft(profile.id, null);
      setDraft({ first: String(data.get("first_name")).trim(), last: String(data.get("last_name")).trim(), joke: String(data.get("favorite_joke") ?? "").trim(), previous: "", needsFile: false });
      resetFile(); setDirty(false); setNotice(""); setOpen(false);
    }
    return saved;
  }, {});
  const photoChanged = Boolean(draft.previous || preview);
  const shownPhoto = preview ?? previousPhotos.find(p => p.avatarPath === draft.previous)?.url ?? avatarUrl;
  return <form action={action} className="profile-form">
    <fieldset disabled={pending} className="profile-fields">
      <button type="button" className={`photo-picker ${photoChanged ? "photo-changed" : ""}`} aria-expanded={open} aria-controls="photo-options" onClick={() => setOpen(!open)}>
        {shownPhoto ? <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shownPhoto} alt="Your profile photo preview" width={96} height={96} />
        </> : <span className="photo-empty">No photo</span>}
        <span>Change photo <span aria-hidden="true">✎</span></span>
      </button>
      {photoChanged && <p role="status">Photo change not saved. <button className="text-button confirmation-link" type="button" onClick={cancelPhoto}>Cancel photo change</button></p>}
      <div id="photo-options" hidden={!open}>
        <label>Upload new photo<input ref={fileInput} type="file" name="photo" accept="image/jpeg,image/png,image/webp,image/gif" aria-describedby="photo-help" onChange={event => {
          const file = event.currentTarget.files?.[0];
          localFile.current = file ?? null;
          const invalid = Boolean(file && (file.size > MAX_AVATAR_BYTES || !AVATAR_TYPES[file.type]));
          event.currentTarget.setCustomValidity(invalid ? "Choose a JPEG, PNG, WebP, or GIF image no larger than 2 MB." : "");
          event.currentTarget.reportValidity();
          setPreview(file && !invalid ? URL.createObjectURL(file) : null);
          change({ ...draft, previous: "", needsFile: Boolean(file) });
        }} /></label>
        <p className="field-help" id="photo-help">JPEG, PNG, WebP, or GIF, up to 2 MB. Your current photo is visible to members. Local files must be selected again if you leave this page.</p>
        <section className="avatar-history"><h2>Previous profile photos</h2>
          {previousPhotos.filter(p => p.avatarPath !== profile.avatar_path).length ? <ul className="avatar-history-list">
            {previousPhotos.filter(p => p.avatarPath !== profile.avatar_path).map((photo, index) => <li key={photo.avatarPath}>
              <button type="button" className="history-choice" aria-label={`Use previous photo ${index + 1}`} aria-pressed={draft.previous === photo.avatarPath} onClick={() => {
                resetFile(); change({ ...draft, previous: photo.avatarPath, needsFile: false });
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={`Photo from ${new Date(photo.createdAt).toLocaleDateString()}`} width={64} height={64} />
                {draft.previous === photo.avatarPath && <span className="photo-check" aria-hidden="true">✓</span>}
              </button>
            </li>)}
          </ul> : <p className="field-help">No previous photos available.</p>}
        </section>
      </div>
      <input type="hidden" name="previous_avatar" value={draft.previous} />
      <label>First name<input name="first_name" autoComplete="given-name" value={draft.first} onChange={e => change({ ...draft, first: e.target.value })} maxLength={80} required /></label>
      <label>Last name<input name="last_name" autoComplete="family-name" value={draft.last} onChange={e => change({ ...draft, last: e.target.value })} maxLength={80} required /></label>
      <label>Favorite joke<textarea name="favorite_joke" value={draft.joke} onChange={e => change({ ...draft, joke: e.target.value })} maxLength={MAX_FAVORITE_JOKE_CHARS} aria-describedby="favorite-joke-help" /></label>
      <p className="field-help" id="favorite-joke-help">Optional. Up to {MAX_FAVORITE_JOKE_CHARS} characters. Your joke is visible to other members. We may use it to improve personalized joke suggestions and generation.</p>
      {notice && <p role="status">{notice}</p>}
      {result.error && <p role="alert">{result.error}</p>}
      {result.success && !dirty && <p role="status">Profile saved. <Link className="confirmation-link" href="/members">Continue to members</Link></p>}
      {dirty && <p className="field-help">Unsaved changes</p>}
      <div className="profile-actions">
        <button className={`button ${dirty ? "save-changed" : ""}`} type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
        {dirty && <button className="button" type="button" onClick={() => {
          resetFile(); setDraft(initial()); setDirty(false); setNotice(""); writeDraft(profile.id, null);
        }}>Discard changes</button>}
      </div>
    </fieldset>
  </form>;
}
