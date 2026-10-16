"use client";
import { useEffect, useState, useTransition } from "react";
import WorkStatus from "@/components/work-status";
import InfoTip from "@/components/info-tip";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { generateOpponent, publishChallenge, voteChallenge } from "../actions";
import type { Challenge, ChallengeResult } from "@/lib/challenges/types";
export default function ChallengePanel({ challenge: c, publicationBlocked = false }: { challenge: Challenge; publicationBlocked?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    if (!c.closes_at || c.closed) return;
    let lastRefresh: number | null = null;
    const tick = () => {
      const left = new Date(c.closes_at!).getTime()-Date.now();
      setRemaining(left>0 ? `${Math.floor(left/3600000)}h ${Math.floor(left%3600000/60000)}m remaining` : "Voting is closing…");
      // Browser and database clocks can differ. Retry gently until the server
      // confirms closure; a single early refresh must not strand the reveal.
      if (left<=0 && (lastRefresh===null || Date.now()-lastRefresh>=5000)) { lastRefresh=Date.now(); router.refresh(); }
    };
    const visible = () => { if (document.visibilityState === "visible") router.refresh(); };
    tick(); const timer=setInterval(tick,1000);
    document.addEventListener("visibilitychange",visible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange",visible); };
  }, [c.closes_at,c.closed,router]);
  const run = (action: () => Promise<ChallengeResult>, label = "Saving your vote…") => {
    setError(""); setOperation(label);
    startTransition(async () => {
    try { const result=await action(); setError(result.error ?? ""); router.refresh(); }
    catch { setError("The request could not finish. Refresh to check its status before retrying."); }
    });
  };
  const published=c.status==="published";
  const total=c.captions.reduce((sum,x)=>sum+(x.votes??0),0);
  const winner=c.closed && total>0 && c.captions.length===2 && c.captions[0].votes!==c.captions[1].votes ? c.captions.reduce((a,b)=>(a.votes??0)>(b.votes??0)?a:b).origin : null;
  return <section className="challenge-panel" aria-busy={pending}>
    {c.own && !published && <>
      <ol className="creation-progress" aria-label="Challenge creation progress">
        <li>1. Image ✓</li><li>2. Your caption ✓</li><li aria-current="step">3. AI opponent &amp; publish</li>
      </ol>
      <h2>Review your matchup</h2>
      <p>Generate your opponent, then publish. <InfoTip label="How publication works">Voting lasts 24 hours. Published challenges cannot be edited. Your preview shows authors; other members see them only after voting closes.</InfoTip></p>
    </>}
    {published && <p>{c.closed ? "Voting closed · authors revealed" : remaining}
      <InfoTip label="Voting rules">One upvote per account. Undo or switch it before closing. Authors and totals stay hidden until then. Creators cannot vote on their own round.
        {c.closes_at && <> Closes <time dateTime={c.closes_at}>{new Date(c.closes_at).toUTCString()}</time>.</>}
      </InfoTip>
    </p>}
    {c.own && published && !c.closed && <p>Your challenge · Waiting for the community’s votes.</p>}
    {pending && <WorkStatus label={operation} />}
    {!pending && c.own && c.status === "generating" && <WorkStatus waiting label="Generation not yet confirmed">
      <p>Check its status, or return to this saved draft later.</p>
    </WorkStatus>}
    <div className="caption-options">{c.captions.map((caption,i)=><article className={`caption-option ${c.vote===caption.id?"selected":""}`} key={caption.id}>
      <span className="muted">{caption.origin ? caption.origin==="ai"?"AI caption":"Human caption" : `Caption ${i+1}`}</span><p>{caption.body}</p>
      {c.closed ? <strong>{caption.votes} upvotes</strong> : published && !c.own ? <button className="button" disabled={pending} aria-pressed={c.vote===caption.id} onClick={()=>run(()=>voteChallenge(c.id,c.vote===caption.id?null:caption.id))}>{c.vote===caption.id?"Undo upvote":"Upvote"}</button> : null}
    </article>)}</div>
    {c.closed && <p role="status">{total===0?"No votes this round.":winner?`${winner==="ai"?"AI":"Human"} caption wins this round.`:"It’s a tie."}</p>}
    {c.own && !published && <div className="challenge-controls">{c.status==="ready" ? <button className="button button-primary" disabled={pending || publicationBlocked} onClick={()=>run(()=>publishChallenge(c.id), "Publishing your challenge…")}>Publish for 24 hours</button> : <button className="button button-primary" disabled={pending} onClick={()=>run(()=>generateOpponent(c.id), "Checking content and writing your opponent…")}>{pending?"Generating…":c.status==="generating"?"Check / retry generation":c.status==="failed"?"Retry AI generation":"Generate AI opponent"}</button>}</div>}
    {c.own && !published && !c.hidden_at && c.status !== "generating" && <Link className="button" href={`/challenges/${c.id}/edit`}>Edit challenge</Link>}
    {publicationBlocked && <button className="button" disabled={pending} onClick={() => router.refresh()}>Check review status</button>}
    {c.own && !published && <div className="draft-exits"><Link href="/challenges/new">Start another</Link><Link href="/challenges?view=yours">View your drafts</Link></div>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
