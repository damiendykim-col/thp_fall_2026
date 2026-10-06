"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateOpponent, publishChallenge, voteChallenge } from "../actions";
import type { Challenge, ChallengeResult } from "@/lib/challenges/types";
export default function ChallengePanel({ challenge: c }: { challenge: Challenge }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    if (!c.closes_at || c.closed) return;
    let refreshed = false;
    const tick = () => {
      const left = new Date(c.closes_at!).getTime()-Date.now();
      setRemaining(left>0 ? `${Math.floor(left/3600000)}h ${Math.floor(left%3600000/60000)}m remaining` : "Voting is closing…");
      if (left<=0 && !refreshed) { refreshed=true; router.refresh(); }
    };
    const visible = () => { if (document.visibilityState === "visible") router.refresh(); };
    tick(); const timer=setInterval(tick,1000);
    document.addEventListener("visibilitychange",visible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange",visible); };
  }, [c.closes_at,c.closed,router]);
  const run = (action: () => Promise<ChallengeResult>) => startTransition(async () => {
    setError("");
    try { const result=await action(); setError(result.error ?? ""); router.refresh(); }
    catch { setError("The request could not finish. Refresh to check its status before retrying."); }
  });
  const published=c.status==="published";
  const total=c.captions.reduce((sum,x)=>sum+(x.votes??0),0);
  const winner=c.closed && total>0 && c.captions.length===2 && c.captions[0].votes!==c.captions[1].votes ? c.captions.reduce((a,b)=>(a.votes??0)>(b.votes??0)?a:b).origin : null;
  return <section className="challenge-panel" aria-busy={pending}>
    {published ? <p>{c.closed ? "Voting closed. Attribution revealed." : `${remaining} · Labels and totals stay hidden until closing.`}{c.closes_at && <> <time dateTime={c.closes_at}>{new Date(c.closes_at).toUTCString()}</time></>}</p> : <p>Your preview shows attribution. Other members won’t see it until voting closes.</p>}
    {c.own && published && !c.closed && <p className="muted">This is your challenge. Creators cannot vote.</p>}
    <div className="caption-options">{c.captions.map((caption,i)=><article className={`caption-option ${c.vote===caption.id?"selected":""}`} key={caption.id}>
      <span className="muted">{caption.origin ? caption.origin==="ai"?"AI caption":"Human caption" : `Caption ${i+1}`}</span><p>{caption.body}</p>
      {c.closed ? <strong>{caption.votes} upvotes</strong> : published && !c.own ? <button className="button" disabled={pending} aria-pressed={c.vote===caption.id} onClick={()=>run(()=>voteChallenge(c.id,c.vote===caption.id?null:caption.id))}>{c.vote===caption.id?"Undo upvote":"Upvote"}</button> : null}
    </article>)}</div>
    {c.closed && <p role="status">{total===0?"No votes this round.":winner?`${winner==="ai"?"AI":"Human"} caption wins this round.`:"It’s a tie."}</p>}
    {c.own && !published && <div className="challenge-controls">{c.status==="ready" ? <button className="button button-primary" disabled={pending} onClick={()=>run(()=>publishChallenge(c.id))}>Publish for 24 hours</button> : <button className="button button-primary" disabled={pending} onClick={()=>run(()=>generateOpponent(c.id))}>{pending?"Generating…":c.status==="generating"?"Check / retry generation":c.status==="failed"?"Retry AI generation":"Generate AI opponent"}</button>}</div>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
