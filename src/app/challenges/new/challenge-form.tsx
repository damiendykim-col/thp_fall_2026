"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createChallenge } from "../actions";
import { uploadChallengeImage, suggestImageDescription } from "../image-actions";
import type { GalleryImage } from "@/lib/images";

export default function ChallengeForm({ templates }: { templates: GalleryImage[] }) {
  const [state, action, pending] = useActionState(createChallenge, {});
  const [source, setSource] = useState("upload");
  const [template, setTemplate] = useState("");
  const [preview, setPreview] = useState("");
  const [submission, setSubmission] = useState("");
  const [imageId, setImageId] = useState("");
  const [description, setDescription] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [manual, setManual] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [context, setContext] = useState("");
  const [caption, setCaption] = useState("");
  const [imageStatus, setImageStatus] = useState("");
  const [imageError, setImageError] = useState("");
  const requestVersion = useRef(0);
  const selectedFile = useRef<File | null>(null);
  const router = useRouter();

  useEffect(() => { if (state.id) router.push(`/challenges/${state.id}`); }, [state.id, router]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function resetReview() {
    requestVersion.current += 1;
    setSubmission(crypto.randomUUID());
    setImageId("");
    setDescription("");
    setSuggestion("");
    setConfirmed(false);
    setManual(false);
    setImageError("");
    setImageStatus("");
  }

  function selectFile(selected: File | null) {
    resetReview();
    selectedFile.current = selected;
    setPreview(selected ? URL.createObjectURL(selected) : "");
    if (!selected) return;
    const version = requestVersion.current;
    setImageStatus("Uploading image…");
    startTransition(async () => {
      try {
        const form = new FormData();
        form.set("image", selected);
        const upload = await uploadChallengeImage(form);
        if (version !== requestVersion.current) return;
        if (!upload.id) { setImageError(upload.error || "Upload failed. Please retry."); return; }
        setImageId(upload.id);
        setImageStatus("Suggesting an image description…");
        const result = await suggestImageDescription(upload.id);
        if (version !== requestVersion.current) return;
        // No ID means analysis is still running or the image is unavailable.
        if (!result.id) setImageId("");
        setDescription(result.description ?? "");
        setSuggestion(result.description ?? "");
        setImageError(result.error ?? "");
      } catch {
        if (version === requestVersion.current) {
          setImageId("");
          setImageError("The request was interrupted. Retry this image to recover its upload and description; if analysis is still running, wait two minutes.");
        }
      } finally {
        if (version === requestVersion.current) setImageStatus("");
      }
    });
  }

  const ready = source === "upload" ? Boolean(imageId) : Boolean(template);
  const imageUrl = source === "upload" ? preview : templates.find(t => t.id === template)?.image_url;

  return (
    <form action={action} className="challenge-form">
      <p className="muted">When you select an upload, its image is sent to Google Gemini to suggest a description. Review it before continuing, or write your own if generation fails. Google’s free API tier may use submitted content to improve its products.</p>
      <label>Image source
        <select aria-label="Image source" value={source} disabled={pending} onChange={e => { resetReview(); selectedFile.current = null; setPreview(""); setTemplate(""); setSource(e.target.value); }}>
          <option value="upload">Upload an image</option><option value="template">Gallery template</option>
        </select>
      </label>
      {source === "upload" ? (
        <label>Challenge image
          <input aria-label="Challenge image" type="file" accept="image/jpeg,image/png,image/webp" disabled={pending} onChange={e => selectFile(e.target.files?.[0] ?? null)} />
          <span className="muted">Still JPEG, PNG or WebP, up to 2 MB. Separate from your profile photo.</span>
        </label>
      ) : (
        <label>Gallery template
          <select aria-label="Gallery template" name="template" required value={template} disabled={pending} onChange={e => {
            resetReview(); setTemplate(e.target.value);
            setDescription(templates.find(t => t.id === e.target.value)?.description ?? "");
          }}>
            <option value="" disabled>Choose a template</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.description || "Untitled image"}</option>)}
          </select>
          <span className="muted">Templates use the description you confirm below; the AI does not analyze their frames.</span>
        </label>
      )}
      {/* Native images preserve animated templates and local upload previews. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {imageUrl && <img className="challenge-image" src={imageUrl} alt="Selected challenge image" />}
      {imageStatus && <p role="status">{imageStatus}</p>}
      {imageError && <p role="alert">{imageError}</p>}
      {imageError && source === "upload" && !imageId && !imageStatus && <button className="button" type="button" disabled={pending} onClick={() => selectFile(selectedFile.current)}>Retry this image</button>}
      <input type="hidden" name="imageId" value={source === "upload" ? imageId : ""} />
      <input type="hidden" name="submission" value={submission} />
      <input type="hidden" name="manual" value={String(manual)} />
      <label>Image description
        <textarea aria-label="Image description" name="description" value={description} disabled={Boolean(imageStatus) || pending || !ready} onChange={e => { setDescription(e.target.value); setConfirmed(false); }} required maxLength={500} placeholder="Describe what is visibly in the image, rather than inventing a situation." />
      </label>
      {suggestion && <>
        <p className="muted">AI suggestion—check the visual details. You can edit it or replace it.</p>
        <button className="button" type="button" disabled={pending} onClick={() => { setManual(true); setDescription(""); setConfirmed(false); }}>Write my own description</button>
        {manual && <button className="button" type="button" disabled={pending} onClick={() => { setManual(false); setDescription(suggestion); setConfirmed(false); }}>Use AI suggestion</button>}
      </>}
      <label className="description-confirmation">
        <input type="checkbox" name="confirmed" checked={confirmed} disabled={!ready || !description.trim() || Boolean(imageStatus) || pending} onChange={e => setConfirmed(e.target.checked)} required />
        I confirm this image description
      </label>
      <label>Add context for the joke (optional)
        <textarea name="context" value={context} onChange={e => setContext(e.target.value)} maxLength={500} placeholder="For example: finding out the assignment was a group project." />
      </label>
      <label>Your caption
        <textarea name="caption" value={caption} onChange={e => setCaption(e.target.value)} required maxLength={280} placeholder="Your best line, up to 280 characters." />
      </label>
      <p className="muted">The confirmed description and optional joke context accompany the image when generating your opponent. Your caption is never sent to the model.</p>
      <p className="muted">Publish only images you have permission to share. Challenges are visible to signed-in users; attribution and results appear after 24 hours. Descriptions and context are frozen when you create the draft.</p>
      {state.error && <p role="alert">{state.error}</p>}
      <button className="button button-primary" disabled={pending || Boolean(imageStatus) || !ready || !confirmed || !caption.trim()}>{pending ? "Saving draft…" : "Create draft"}</button>
    </form>
  );
}
