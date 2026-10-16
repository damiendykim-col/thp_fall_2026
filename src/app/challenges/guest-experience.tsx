"use client";
import { useRef, useState, type ReactNode } from 'react';
import ChallengeDemo from './demo';

export default function GuestExperience({ signIn }: { signIn: ReactNode }) {
  const [mode, setMode] = useState<'practice' | 'sign-in'>('practice');
  const signInHeading = useRef<HTMLHeadingElement>(null);
  function openSignIn() {
    setMode('sign-in');
    requestAnimationFrame(() => signInHeading.current?.focus());
  }
  return <>
    <div className="landing-options" role="group" aria-label="Choose your experience">
      <button className={`button ${mode === 'practice' ? 'button-primary' : ''}`} aria-pressed={mode === 'practice'} aria-controls="practice-panel" onClick={() => setMode('practice')}>Practice round</button>
      <span className="landing-or">OR</span>
      <button className={`button ${mode === 'sign-in' ? 'button-primary' : ''}`} aria-pressed={mode === 'sign-in'} aria-controls="sign-in-panel" onClick={() => setMode('sign-in')}>Sign in</button>
    </div>
    <div id="practice-panel" hidden={mode !== 'practice'}>
      <ChallengeDemo onSignIn={openSignIn} />
    </div>
    <section id="sign-in-panel" className="landing-sign-in" hidden={mode !== 'sign-in'} aria-labelledby="guest-sign-in-heading">
      <span className="eyebrow">Your next round counts</span>
      <h2 id="guest-sign-in-heading" ref={signInHeading} tabIndex={-1}>Ready for a real round?</h2>
      <p>Sign in to create a challenge, vote, and see the reveal.</p>
      {signIn}
      <p className="muted">Google opens to complete sign-in. You can switch back to practice before continuing.</p>
    </section>
  </>;
}
