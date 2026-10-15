"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createChallenge, updateChallenge } from "../actions";
import { uploadChallengeImage, suggestImageDescription, restoreChallengeImage } from "../image-actions";
import { MAX_CHALLENGE_UPLOAD_BYTES, CHALLENGE_UPLOAD_SIZE_MESSAGE } from "@/lib/challenges/upload-limits";
import { readChallengeDraft, writeChallengeDraft, type ChallengeDraft } from "@/lib/challenge-draft";
import FrameReview from "./frame-review";
import type { Storyboard } from "@/lib/challenges/gif-types";
import type { ChallengeResult } from "@/lib/challenges/types";
import type { GalleryImage } from "@/lib/images";

type FormProps = { userId: string; templates: GalleryImage[]; editing?: { id: string; revision: number; initial: ChallengeDraft } };
export default function ChallengeForm(props: FormProps) {
  return <AccountChallengeForm key={`${props.userId}:${props.editing?.id ?? "new"}:${props.editing?.revision ?? 0}`} {...props} />;
}

function AccountChallengeForm({ userId, templates, editing }: FormProps) {
  const storageKey = editing ? `${userId}:edit:${editing.id}:${editing.revision}` : userId;
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  function changeStep(next: 1 | 2) {
    setStep(next);
    requestAnimationFrame(() => stepHeading.current?.focus());
  }
  const [state, action, pending] = useActionState(async (previous: ChallengeResult, form: FormData) => {
    const result = editing
      ? await updateChallenge(editing.id, editing.revision, previous, form)
      : await createChallenge(previous, form);
    if (result.id) {
      // Server revalidation can remount an edit form with its new revision before an
      // effect sees the action result. Complete recovery cleanup/navigation here.
      writeChallengeDraft(storageKey, null);
      router.push(`/challenges/${result.id}`);
    }
    return result;
  }, {});
  const [source, setSource] = useState("upload");
  const [template, setTemplate] = useState("");
  const [preview, setPreview] = useState("");
  const [submission, setSubmission] = useState("");
  const [storyboard,setStoryboard] = useState<Storyboard>();
  const [imageId, setImageId] = useState("");
  const [imageReady, setImageReady] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [needsFile, setNeedsFile] = useState(false);
  const [draftNotice, setDraftNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    const stored = readChallengeDraft(storageKey);
    const draft = stored ?? editing?.initial;
    const version = ++requestVersion.current;
    // Restore tab-local storage after hydration; it is unavailable during server rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSubmission(draft?.submission || crypto.randomUUID());
    if (draft) {
      setSource(draft.source); setTemplate(draft.template);
      setDescription(draft.description); setSuggestion(draft.suggestion);
      setManual(draft.manual); setContext(draft.context); setCaption(draft.caption);
      setNeedsFile(draft.needsFile); setImageId(draft.imageId);
      if (stored) setDraftNotice("Restored your unfinished changes in this tab.");
      if (draft.source === "template") {
        if (templates.some(t => t.id === draft.template)) setConfirmed(draft.confirmed);
        else { setTemplate(""); setDraftNotice("Your previous template is unavailable. Choose another; your text has been kept."); }
      } else if (draft.imageId) {
        // Preserve review choices during validation, while imageStatus locks submission.
        setImageReady(draft.imageReady); setConfirmed(draft.imageReady && draft.confirmed);
        setImageStatus("Restoring saved image…");
        void restoreChallengeImage(draft.imageId).then(result => {
          if (version !== requestVersion.current) return;
          if (result.url) {
            setPreview(result.url); setImageReady(draft.imageReady); setConfirmed(draft.imageReady && draft.confirmed);
            if (!draft.imageReady) setImageError("Your upload is saved. Retry description to continue its review.");
          } else { setImageReady(false); setConfirmed(false); setImageId(""); setNeedsFile(true); setImageError(result.error || "Choose your image again; your text has been kept."); }
        }).catch(() => {
          if (version === requestVersion.current) { setImageReady(false); setConfirmed(false); setImageId(""); setNeedsFile(true); setImageError("Your saved image could not be restored. Choose it again; your text has been kept."); }
        }).finally(() => { if (version === requestVersion.current) setImageStatus(""); });
      }
    }
    setInitialized(true);
    return () => { requestVersion.current += 1; };
  // AccountChallengeForm is keyed by user; template refreshes must not overwrite edits.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!initialized) return;
    const hasWork = caption || context || template || imageId || needsFile || description;
    const saved = writeChallengeDraft(storageKey, state.id || !hasWork ? null : {
      source, template, imageId, submission, description, suggestion, context, caption,
      manual, confirmed, needsFile, imageReady,
    });
    // Report failure to synchronize with browser storage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!saved) setDraftNotice("Browser recovery is unavailable. Keep this tab open until you create your draft.");
  }, [initialized, storageKey, state.id, source, template, imageId, submission, description, suggestion, context, caption, manual, confirmed, needsFile, imageReady]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function resetReview() {
    requestVersion.current += 1;
    setSubmission(crypto.randomUUID());
    setImageId("");
    setImageReady(false);
    setNeedsFile(false);
    setStoryboard(undefined);
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
    setNeedsFile(Boolean(selected));
    setPreview(selected ? URL.createObjectURL(selected) : "");
    if (!selected) return;
    if (!selected.size || selected.size > MAX_CHALLENGE_UPLOAD_BYTES) { setImageError(CHALLENGE_UPLOAD_SIZE_MESSAGE); return; }
    const version = requestVersion.current;
    setImageStatus("Uploading image…");
    startTransition(async () => {
      try {
        const form = new FormData();
        form.set("image", selected);
        const upload = await uploadChallengeImage(form);
        if (version !== requestVersion.current) return;
        if (upload.storyboard) { setStoryboard(upload.storyboard); return; }
        if (!upload.id) { setImageError(upload.error || "Upload failed. Please retry."); return; }
        setImageId(upload.id);
        setNeedsFile(false);
        await reviewImage(upload.id, version);
      } catch {
        if (version === requestVersion.current) {
          setImageError("The upload was interrupted. Retry this image.");
        }
      } finally {
        if (version === requestVersion.current) setImageStatus("");
      }
    });
  }

  async function confirmFrames(frames: number[]): Promise<boolean> {
    const file = selectedFile.current;
    if (!file) return false;
    const version = requestVersion.current;
    setImageStatus("Saving frames and checking image…"); setImageError("");
    try {
      const form = new FormData(); form.set("image",file); form.set("frames",JSON.stringify(frames));
      const upload = await uploadChallengeImage(form);
      if (version !== requestVersion.current) return false;
      if (!upload.id) { setImageError(upload.error || "Frames could not be saved."); return false; }
      setImageId(upload.id); setNeedsFile(false);
      await reviewImage(upload.id, version);
      if (version !== requestVersion.current) return false;
      return true;
    } catch { if (version === requestVersion.current) setImageError("Frame confirmation could not finish. Please retry."); return false; }
    finally { if (version === requestVersion.current) setImageStatus(""); }
  }

  async function reviewImage(id: string, version: number) {
    setImageStatus("Suggesting an image description…"); setImageError(""); setImageReady(false); setConfirmed(false);
    try {
      const result = await suggestImageDescription(id);
      if (version !== requestVersion.current) return;
      setImageReady(Boolean(result.id));
      setDescription(result.description ?? ""); setSuggestion(result.description ?? "");
      setManual(Boolean(result.id && !result.description));
      setImageError(result.error ?? "");
    } catch {
      if (version === requestVersion.current) setImageError("Your image is saved, but description review was interrupted. Retry description; if it is still running, wait two minutes.");
    } finally { if (version === requestVersion.current) setImageStatus(""); }
  }

  function discard() {
    if (editing) {
      writeChallengeDraft(storageKey, null);
      router.push(`/challenges/${editing.id}`);
      return;
    }
    setStep(1);
    resetReview(); setCaption(""); setContext(""); setSource("upload"); setTemplate(""); setPreview("");
    selectedFile.current = null;
    if (fileInput.current) fileInput.current.value = "";
    writeChallengeDraft(storageKey, null); setDraftNotice("Unfinished challenge discarded.");
  }

  const ready = source === "upload" ? Boolean(imageId) && imageReady : Boolean(template);
  const imageUrl = source === "upload" ? preview : templates.find(t => t.id === template)?.image_url;

  return (
    <form action={action} className="challenge-form" onSubmit={e => {
      if (!editing && step !== 2) e.preventDefault();
    }}>
      {!editing && <>
        <nav aria-label="Challenge creation progress" className="creation-progress">
          <button type="button" aria-current={step === 1 ? "step" : undefined} disabled={pending} onClick={() => changeStep(1)}>1. Image</button>
          <button type="button" aria-current={step === 2 ? "step" : undefined} disabled={pending} onClick={() => changeStep(2)}>2. Your caption</button>
          <span>3. AI opponent &amp; publish</span>
        </nav>
        <h2 ref={stepHeading} tabIndex={-1}>{step === 1 ? "Choose and review your image" : "Write your contender"}</h2>
      </>}
      {draftNotice && <p role="status">{draftNotice}</p>}
      <div className="creation-stage" hidden={!editing && step !== 1}>
      <p className="muted">Choose an image you have permission to share, then confirm what the AI sees.</p>
      <p className="muted">When you select an upload, its image is sent to Google Gemini to suggest a description. Review it before continuing, or write your own if generation fails. Google’s free API tier may use submitted content to improve its products.</p>
      <label>Image source
        <select aria-label="Image source" value={source} disabled={pending} onChange={e => { resetReview(); selectedFile.current = null; setPreview(""); setTemplate(""); setSource(e.target.value); }}>
          <option value="upload">Upload an image</option><option value="template">Gallery template</option>
        </select>
      </label>
      {source === "upload" ? (
        <label>Challenge image
          <input ref={fileInput} aria-label="Challenge image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={pending} onChange={e => selectFile(e.target.files?.[0] ?? null)} />
          <span className="muted">JPEG, PNG, WebP or GIF, up to 3 MB. GIFs: up to 120 frames and 30 seconds; moderator review required before publication.</span>
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
      {storyboard && <FrameReview key={preview} data={storyboard} onConfirm={confirmFrames} onChange={() => { requestVersion.current += 1; setImageReady(false); setNeedsFile(true); setImageId(""); setDescription(""); setSuggestion(""); setConfirmed(false); setManual(false); }} notice="Confirming saves these frames and requests an AI description. A moderator must review the full GIF before publication." />}
      {needsFile && !selectedFile.current && <p role="status">Choose your local file again to continue. File contents are not stored in your browser draft.</p>}
      {imageId && !imageReady && !imageStatus && <p className="muted">Upload saved; description review is not complete.</p>}
      {imageError && imageId && !imageReady && !imageStatus && <button className="button" type="button" disabled={pending} onClick={() => startTransition(() => reviewImage(imageId, requestVersion.current))}>Retry description</button>}
      {imageStatus && <p role="status">{imageStatus}</p>}
      {imageError && <p role="alert">{imageError}</p>}
      {imageError && source === "upload" && !imageId && selectedFile.current && !storyboard && !imageStatus && <button className="button" type="button" disabled={pending} onClick={() => selectFile(selectedFile.current)}>Retry this image</button>}
      <input type="hidden" name="imageId" value={source === "upload" ? imageId : ""} />
      <input type="hidden" name="submission" value={submission} />
      <input type="hidden" name="manual" value={String(manual)} />
      <details className="image-understanding">
        <summary><span>Review image understanding</span><span className="review-status">{!ready ? "Choose an image first" : imageStatus ? "Analyzing…" : confirmed ? "Confirmed" : "Confirmation needed"}</span></summary>
        <div className="image-understanding-fields">
          <p className="muted">This description helps the AI understand the scene. Check it once, then focus on your joke.</p>
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
        </div>
      </details>
      {ready && !confirmed && !imageStatus && <p className="field-help">Open “Review image understanding” above and confirm the scene to continue.</p>}
      {!editing && <button type="button" className="button button-primary" disabled={pending || Boolean(imageStatus) || !ready || !confirmed} onClick={() => changeStep(2)}>Continue to caption</button>}
      </div>
      <div className="creation-stage" hidden={!editing && step !== 2}>
      {!editing && imageUrl && <div className="caption-image-preview">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="Your caption’s image" />
        <button type="button" className="button" disabled={pending} onClick={() => changeStep(1)}>Back to image</button>
      </div>}
      {!editing && !imageUrl && <button type="button" className="button" onClick={() => changeStep(1)}>Back to image</button>}
      <label>Your caption
        <textarea name="caption" value={caption} disabled={pending} onChange={e => setCaption(e.target.value)} required maxLength={280} placeholder="Your best line, up to 280 characters." />
      </label>
      <label>Add context for the joke (optional)
        <textarea name="context" disabled={pending} value={context} onChange={e => setContext(e.target.value)} maxLength={500} placeholder="For example: finding out the assignment was a group project." />
      </label>
      <p className="muted">The confirmed description and optional joke context accompany the image when generating your opponent. Your caption is sent separately to Gemini for safety checking, but never to the opponent-caption generator.</p>
      <p className="muted">Dark humor and satire are welcome; targeted abuse and harmful content are not. Your draft must pass safety checks. Next, generate your AI opponent and review both captions before publishing.</p>
      {state.error && <p role="alert">{state.error}</p>}
      {!editing && (!ready || !confirmed || Boolean(imageStatus)) && <p role="status">Finish image review in step 1 before creating your draft. Your caption will be kept.</p>}
      <button className="button button-primary" disabled={pending || Boolean(imageStatus) || !ready || !confirmed || !caption.trim()}>{pending ? "Saving…" : editing ? "Save changes" : "Create draft"}</button>
      </div>
      <p className="muted">Unfinished text and saved image references are kept in this browser tab until you save, discard them, or sign out. Local files must be selected again.</p>
      <button className="button" type="button" disabled={pending || Boolean(imageStatus)} onClick={discard}>{editing ? "Discard edits" : "Discard unfinished challenge"}</button>
    </form>
  );
}
