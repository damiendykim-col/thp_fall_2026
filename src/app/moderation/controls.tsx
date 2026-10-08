"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveTemplate, dismissReport, hideChallenge } from "../challenges/moderation-actions";
export default function ModeratorControls({ challengeId, reportId, templateId }: { challengeId?: string; reportId?: string; templateId?: string }) {
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
    {challengeId && <button className="button" disabled={pending} onClick={() => run(() => hideChallenge(challengeId))}>Hide challenge</button>}
    {reportId && <button className="button" disabled={pending} onClick={() => run(() => dismissReport(reportId))}>Dismiss report</button>}
    {templateId && <button className="button" disabled={pending} onClick={() => run(() => approveTemplate(templateId))}>Approve template for challenges</button>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
