"use client";
import { useState } from 'react';
import Link from 'next/link';

export default function ChallengeDemo({ signedIn = false }: { signedIn?: boolean }) {
  const [contender, setContender] = useState('Group project. Singular contributor.');
  const [revealed, setRevealed] = useState(false);
  const [choice, setChoice] = useState<number | null>(null);
  return <section className="challenge-demo" aria-label="Example challenge">
    <div className="demo-image">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/challenge-demo.svg" alt="A group project checklist with no replies, due tomorrow" />
    </div>
    <div className="demo-content">
      <span className="eyebrow">Try an example</span><h2>You versus AI</h2>
      <label>Try your own caption<input aria-label="Try your own caption" maxLength={280} value={contender} onChange={e => { setContender(e.target.value); setChoice(null); setRevealed(false); }} /></label>
      <p className="muted">In a real round, you won’t know who wrote each caption until voting closes.</p>
      {[contender.trim() || 'Your best line goes here.', 'Our strongest collaboration was agreeing to start tomorrow.'].map((caption, index) =>
        <button key={caption} className={`demo-caption ${choice === index ? 'selected' : ''}`} aria-pressed={choice === index} onClick={() => setChoice(choice === index ? null : index)}>
          <span>{revealed ? index === 0 ? "Your contender" : "Example AI opponent" : `Caption ${index + 1}`}</span>{caption}{choice === index && <strong>Your pick · tap to undo</strong>}
        </button>)}
      {choice !== null && !revealed && <button className="button" onClick={() => setRevealed(true)}>Reveal demo roles</button>}
      {revealed && <p role="status">Demo only: the opponent is a fixed example. No live AI generation or votes. Real rounds reveal authors after 24 hours.</p>}
      <p className="demo-note" role="status">{choice === null ? 'Illustrative captions. No votes are recorded.' : signedIn ? 'Example pick only. Your live votes are saved in open challenges.' : 'Got a favorite? Sign in to vote in a live challenge.'}</p>
      <Link className="button button-primary" href={signedIn ? "/challenges/new" : "/login"}>{signedIn ? "Create your own challenge" : "Join the challenges"}</Link>
    </div>
  </section>;
}
