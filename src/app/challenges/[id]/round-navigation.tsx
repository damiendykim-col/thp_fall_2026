import Link from 'next/link';

export default function RoundNavigation({ previous, next }: { previous?: string; next?: string }) {
  if (!previous && !next) return null;
  return <nav className="round-navigation" aria-label="Browse open challenges">
    {previous ? <Link className="button" href={`/challenges/${previous}`}>← Previous round</Link> : <span />}
    {next ? <Link className="button button-primary" href={`/challenges/${next}`}>Next round →</Link> : <Link className="button" href="/challenges">Back to challenges</Link>}
  </nav>;
}
