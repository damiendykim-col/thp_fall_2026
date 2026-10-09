"use client";
import { useState } from 'react';
import Link from 'next/link';

export default function ChallengeDemo() {
  const [choice, setChoice] = useState<number | null>(null);
  return <section className="challenge-demo" aria-label="Example challenge">
    <div className="demo-image">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/challenge-demo.svg" alt="A group project checklist with no replies, due tomorrow" />
    </div>
    <div className="demo-content">
      <span className="eyebrow">Try an example</span><h2>Which caption would you pick?</h2>
      <p className="muted">In a real round, you won’t know who wrote each caption until voting closes.</p>
      {['Group project. Singular contributor.', 'Our strongest collaboration was agreeing to start tomorrow.'].map((caption, index) =>
        <button key={caption} className={`demo-caption ${choice === index ? 'selected' : ''}`} aria-pressed={choice === index} onClick={() => setChoice(choice === index ? null : index)}>
          <span>Caption {index + 1}</span>{caption}{choice === index && <strong>Your pick · tap to undo</strong>}
        </button>)}
      <p className="demo-note" role="status">{choice === null ? 'Illustrative captions. No votes are recorded.' : 'Got a favorite? Sign in to vote in a live challenge.'}</p>
      <Link className="button button-primary" href="/login">Join the challenges</Link>
    </div>
  </section>;
}
