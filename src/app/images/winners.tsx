import Link from "next/link";
import type { ChallengeWinner } from "@/lib/challenges/winners";

function WinnerCard({ winner }: { winner: ChallengeWinner }) {
  const attribution = winner.origin === "ai" ? "AI-generated" : "Human-written";

  return (
    <li className="winner-card">
      <div className="winner-image">
        {/* Native images preserve animated templates. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {winner.imageUrl ? <img src={winner.imageUrl} alt={winner.situation} loading="lazy" /> : (
          <p className="muted">Image unavailable. Try refreshing.</p>
        )}
      </div>
      <div className="winner-content">
        <p className="winner-caption">{winner.caption}</p>
        <span className="caption-attribution" aria-label={`Caption: ${attribution}`}>
          {attribution}
        </span>
        <div className="winner-result">
          <span>Challenge winner</span>
          <span className="muted">
            {winner.upvotes} {winner.upvotes === 1 ? "upvote" : "upvotes"}
          </span>
        </div>
        <Link href={`/challenges/${winner.challenge_id}`}>View results</Link>
      </div>
    </li>
  );
}

export default function Winners({ winners }: { winners: ChallengeWinner[] }) {
  if (!winners.length) {
    return (
      <div className="status-panel">
        <h2>No winners yet.</h2>
        <p>A closed challenge with a clear winner and at least one upvote earns a place here.</p>
        <Link className="button" href="/challenges">Browse challenges</Link>
      </div>
    );
  }

  return (
    <>
      <p className="muted winners-intro">
        Winning captions from finished challenges. Ties and rounds without votes sit this one out.
      </p>
      <ul className="winners-grid">
        {winners.map((winner) => <WinnerCard key={winner.challenge_id} winner={winner} />)}
      </ul>
      {winners.length === 50 && <p className="muted">Showing the latest 50 winners.</p>}
    </>
  );
}
