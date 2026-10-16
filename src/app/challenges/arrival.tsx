import Link from "next/link";
import type { ReturnData, SavedDraft, ResultRound } from "@/lib/challenges/arrival";
import ChallengeDemo from "./demo";

export function ReturnVisits({ draft, drafts, recent, error }: ReturnData) {
  return <aside className="return-visits" aria-label="Pick up where you left off">
    {(drafts ?? (draft ? [draft] : [])).map((item, index) => <Link key={item.id} href={`/challenges/${item.id}`}>
      {index === 0 ? 'Resume your draft' : `Draft ${index + 1}`} · {item.status === 'ready' ? 'Review & publish' : item.status === 'generating' ? 'Check progress' : item.status === 'failed' ? 'Retry generation' : 'Continue'} →
    </Link>)}
    {draft && <Link href="/challenges?view=yours">All your drafts & rounds →</Link>}
    {recent.length > 0 && <Link href="/challenges?view=results">Recent results →</Link>}
    {error && <p role="alert">Some of your recent activity couldn’t be loaded. You can still browse challenges or open Yours.</p>}
  </aside>;
}

export function ArrivalEmpty({ draft, results = false, yours = false }: { draft?: SavedDraft | null; results?: boolean; yours?: boolean }) {
  return <section className="empty-challenges">
    <h2>{results ? "No finished rounds yet." : yours ? "Make your first challenge." : "No open rounds right now."}</h2>
    <p>{draft ? "Continue a saved matchup or start another while you wait." : "Start a round with your own caption, or try the example to see how voting works."}</p>
    <div className="empty-actions"><Link className="button button-primary" href={draft ? `/challenges/${draft.id}` : "/challenges/new"}>{draft ? "Resume your draft" : "Start a challenge"}</Link>{draft && <Link className="button" href="/challenges/new">Start another</Link>}</div>
    <details className="empty-example"><summary>Try an example · no votes recorded</summary><ChallengeDemo signedIn /></details>
  </section>;
}

export function RoundResults({ rounds }: { rounds: ResultRound[] }) {
  return <ul className="round-results">{rounds.filter(r => r.closed && !r.hidden_at).map(round => {
    const total = round.captions.reduce((sum, c) => sum + (c.votes ?? 0), 0);
    const [first, second] = round.captions;
    const winner = first && second && first.votes !== second.votes ? ((first.votes ?? 0) > (second.votes ?? 0) ? first : second) : null;
    const outcome = round.captions.length !== 2 ? "Results unavailable" : !total ? "No votes this round" : !winner ? "It’s a tie" : winner.origin === "human" ? "Human caption wins" : "AI caption wins";
    return <li className="round-result" key={round.id}>
      <div className="winner-image">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {round.imageUrl ? <img src={round.imageUrl} alt={round.image_description || round.situation} loading="lazy" /> : <p className="muted">Image unavailable</p>}
      </div>
      <div className="winner-content"><h2>{outcome}</h2>
        {round.joke_context && <p>{round.joke_context}</p>}
        {round.captions.map(c => <div className="result-caption" key={c.id}><span className="caption-attribution">{c.origin === "human" ? "Human-written" : "AI-generated"}</span><p>{c.body}</p><span className="muted">{c.votes ?? 0} {(c.votes ?? 0) === 1 ? "upvote" : "upvotes"}</span></div>)}
        {round.closes_at && <time className="muted" dateTime={round.closes_at}>Closed {new Date(round.closes_at).toUTCString()}</time>}
        <Link href={`/challenges/${round.id}`}>View full results</Link>
      </div>
    </li>;
  })}</ul>;
}
