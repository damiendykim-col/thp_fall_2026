import Link from "next/link";
import type { ReturnData, SavedDraft, ResultRound } from "@/lib/challenges/arrival";
import ChallengeDemo from "./demo";

export function ReturnVisits({ draft, recent, error }: ReturnData) {
  return <aside className="return-visits" aria-label="Pick up where you left off">
    {draft && <section><h2>Continue your challenge</h2><p className="muted">{draft.status === "ready" ? "Your matchup is ready to review and publish." : draft.status === "generating" ? "Check on your AI opponent’s generation." : "Your saved draft is waiting for you."}</p><Link className="button" href={`/challenges/${draft.id}`}>Resume your draft</Link></section>}
    {recent.length > 0 && <section><h2>Your recent results</h2><p className="muted">Closed rounds you created or voted in.</p><ul>{recent.map(round => <li key={round.id}><Link href={`/challenges/${round.id}`}>{round.joke_context || "See the reveal"} →</Link><time dateTime={round.closes_at}>Closed {new Date(round.closes_at).toUTCString()}</time></li>)}</ul></section>}
    {error && <p role="alert">Some of your recent activity couldn’t be loaded. You can still browse challenges or open Yours.</p>}
  </aside>;
}

export function ArrivalEmpty({ draft, results = false, yours = false }: { draft?: SavedDraft | null; results?: boolean; yours?: boolean }) {
  return <section className="empty-challenges">
    <h2>{results ? "No finished rounds yet." : yours ? "Make your first challenge." : "No open rounds right now."}</h2>
    <p>{draft ? "Continue your saved matchup, or try the example while you wait for more rounds." : "Start a round with your own caption, or try the example to see how voting works."}</p>
    <div className="empty-actions"><Link className="button button-primary" href={draft ? `/challenges/${draft.id}` : "/challenges/new"}>{draft ? "Resume your draft" : "Start a challenge"}</Link></div>
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
