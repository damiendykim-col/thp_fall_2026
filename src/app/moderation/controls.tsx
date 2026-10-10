"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewGif, approveTemplate, dismissReport, hideChallenge } from "../challenges/moderation-actions";
export default function ModeratorControls({ challengeId, reportId, templateId, gifId }: { challengeId?: string; reportId?: string; templateId?: string; gifId?: string }) {
  const [reviewed,setReviewed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  function run(action: () => Promise<{ error?: string }>) {
    startTransition(async () => {
      try { const result = await action(); setError(result.error ?? ""); router.refresh(); }
      catch { setError("The request did not finish. Please retry."); }
    });
  }
  return <div className="challenge-controls">
    {gifId && <><label><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />I reviewed the full animation, including transitions and brief text.</label>
      <button className="button" disabled={pending || !reviewed} onClick={() => run(() => reviewGif(gifId,true))}>Approve full GIF</button>
      <button className="button" disabled={pending} onClick={() => run(() => reviewGif(gifId,false))}>Reject GIF</button></>}
    {challengeId && <button className="button" disabled={pending} onClick={() => run(() => hideChallenge(challengeId))}>Hide challenge</button>}
    {reportId && <button className="button" disabled={pending} onClick={() => run(() => dismissReport(reportId))}>Dismiss report</button>}
    {templateId && <button className="button" disabled={pending} onClick={() => run(() => approveTemplate(templateId))}>Approve template for challenges</button>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
