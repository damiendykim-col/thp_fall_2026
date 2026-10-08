"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { hideChallenge, reportChallenge } from "../moderation-actions";

export default function SafetyControls({ id, own }: { id: string; own: boolean }) {
  const [reason, setReason] = useState("harassment");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return <details className="challenge-safety">
    <summary>{own ? "Manage visibility" : "Report this challenge"}</summary>
    {own ? <p>Hide this challenge from other members and Winners. This stops voting and cannot be undone here.</p> : <>
      <label>Report reason<select aria-label="Report reason" value={reason} onChange={e => setReason(e.target.value)}>
        <option value="harassment">Targeted harassment</option><option value="hate">Hateful content</option>
        <option value="violence">Threats or graphic violence</option><option value="sexual">Sexual exploitation or explicit content</option>
        <option value="self_harm">Encouraging self-harm</option><option value="privacy">Private information or intimate content</option><option value="other">Other concern</option>
      </select></label>
      <p className="muted">Reports go to the moderator queue. Reporting does not automatically remove a challenge.</p>
    </>}
    <button type="button" className="button" disabled={pending || Boolean(message)} onClick={() => startTransition(async () => {
      setError("");
      try {
        const result = own ? await hideChallenge(id) : await reportChallenge(id, reason);
        if (result.error) setError(result.error);
        else { setMessage(own ? "Challenge hidden." : "Report received. Thank you."); router.refresh(); }
      } catch { setError("The request did not finish. Please retry."); }
    })}>{own ? "Hide challenge" : "Submit report"}</button>
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
  </details>;
}
