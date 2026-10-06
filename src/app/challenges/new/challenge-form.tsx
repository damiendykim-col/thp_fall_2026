"use client";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createChallenge } from "../actions";
import type { GalleryImage } from "@/lib/images";

export default function ChallengeForm({ templates }: { templates: GalleryImage[] }) {
  const [state, action, pending] = useActionState(createChallenge, {});
  const [source, setSource] = useState("upload");
  const [situation, setSituation] = useState("");
  const [caption, setCaption] = useState("");
  const router = useRouter();
  useEffect(() => { if (state.id) router.push(`/challenges/${state.id}`); }, [state.id, router]);
  return <form action={action} className="challenge-form">
    <label>Image source<select value={source} onChange={e => setSource(e.target.value)}><option value="upload">Upload an image</option><option value="template">Gallery template</option></select></label>
    {source === "upload" ? <label>Challenge image<input type="file" name="image" accept="image/jpeg,image/png,image/webp" required /><span className="muted">Still JPEG, PNG or WebP, up to 2 MB. Separate from your profile photo.</span></label>
      : <label>Gallery template<select name="template" required defaultValue=""><option value="" disabled>Choose a template</option>{templates.map(t => <option key={t.id} value={t.id}>{t.description || "Untitled image"}</option>)}</select><span className="muted">For GIF templates, the AI uses your scene description below, not the animation.</span></label>}
    <label>Situation / scene description<textarea name="situation" value={situation} onChange={e => setSituation(e.target.value)} required maxLength={500} placeholder="Describe the scene and the situation you want to joke about." /></label>
    <label>Your caption<textarea name="caption" value={caption} onChange={e => setCaption(e.target.value)} required maxLength={280} placeholder="Your best line, up to 280 characters." /></label>
    <p className="muted">Your image and situation will be sent to Google Gemini when you generate the opponent. Your caption stays private from the model. Google’s free API tier may use submitted content to improve its products.</p>
    <p className="muted">Publish only images you have permission to share. Challenges are visible to signed-in users for voting; attribution and results appear after 24 hours. One successful AI caption per draft, up to three attempts.</p>
    {state.error && <p role="alert">{state.error}</p>}
    <button className="button button-primary" disabled={pending}>{pending ? "Saving draft…" : "Create draft"}</button>
  </form>;
}
