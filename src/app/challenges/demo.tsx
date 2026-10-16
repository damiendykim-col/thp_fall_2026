"use client";
import { useRef, useState } from 'react';
import Link from 'next/link';

const examples = [
  { name: 'Group project', image: '/challenge-demo.svg', alt: 'A group project checklist with no replies, due tomorrow', suggestion: 'Group project. Singular contributor.', opponent: 'Our strongest collaboration was agreeing to start tomorrow.' },
  { name: 'Rainy commute', image: '/challenge-demo-rain.svg', alt: 'An umbrella blown inside out in the rain beside a bus stop', suggestion: 'My umbrella has resigned effective immediately.', opponent: 'Forecast: a 100% chance of arriving as a wet floor sign.' },
];
const steps = ['Choose your image', 'Write your caption', 'Meet your opponent', 'Try the voting', 'Preview the reveal'];

export default function ChallengeDemo({ signedIn = false }: { signedIn?: boolean }) {
  const [step, setStep] = useState(0);
  const [image, setImage] = useState(0);
  const [caption, setCaption] = useState('');
  const [choice, setChoice] = useState<number | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const example = examples[image];
  function go(next: number) {
    setStep(next);
    // Keep keyboard and screen-reader users at the newly displayed step.
    heading.current?.focus();
  }
  function reset() {
    setImage(0); setCaption(''); setChoice(null); go(0);
  }
  return <section id="practice" className="challenge-demo" aria-label="Practice challenge">
    <div className="demo-image">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={example.image} alt={example.alt} />
    </div>
    <div className="demo-content">
      <span className="eyebrow">Practice round · nothing is saved</span>
      <p className="muted" role="status">Step {step + 1} of {steps.length} · {steps[step]}</p>
      <progress className="demo-progress" aria-label="Practice progress" max={steps.length} value={step + 1} />
      <h2 ref={heading} tabIndex={-1}>{steps[step]}</h2>
      {step === 0 && <>
        <p>Pick your starting point. In a real challenge, you can upload your own image.</p>
        <div className="demo-actions">{examples.map((item, index) => <button key={item.name} className="button" aria-pressed={image === index} onClick={() => { if (image !== index) { setImage(index); setCaption(''); setChoice(null); } }}>{item.name}</button>)}</div>
        <button className="button button-primary" onClick={() => go(1)}>Use this image</button>
      </>}
      {step === 1 && <>
        <label>Your caption<input maxLength={280} value={caption} placeholder="Give this image a punchline…" onChange={e => { setCaption(e.target.value); setChoice(null); }} /></label>
        <button className="button" onClick={() => { setCaption(example.suggestion); setChoice(null); }}>Suggest a caption</button>
        <div className="demo-actions"><button className="button button-primary" disabled={!caption.trim()} onClick={() => go(2)}>Meet your opponent</button></div>
      </>}
      {step === 2 && <>
        <p className="muted">Prepared example · no AI is being called in this practice round.</p>
        <blockquote className="demo-caption">{example.opponent}</blockquote>
        <p>In a real round, AI writes a caption for your image. Then other members pick their favorite.</p>
        <button className="button button-primary" onClick={() => go(3)}>Try voting</button>
      </>}
      {step >= 3 && <>
        <p>{step === 3 ? 'Now try being a voter. Real creators cannot vote on their own round; authors stay hidden until closing.' : 'Time skip! Real rounds reveal authors and totals after 24 hours. No community votes were cast here, so this preview has no winner.'}</p>
        {[caption.trim(), example.opponent].map((body, index) => step === 3
          ? <button key={index} className={`demo-caption ${choice === index ? 'selected' : ''}`} aria-pressed={choice === index} onClick={() => setChoice(choice === index ? null : index)}><span>Caption {index + 1}</span>{body}{choice === index && <strong>Your practice pick · tap to undo</strong>}</button>
          : <div key={index} className={`demo-caption ${choice === index ? 'selected' : ''}`}><span>{index === 0 ? 'Your caption' : 'Example AI opponent'}</span>{body}{choice === index && <strong>Your practice pick</strong>}</div>)}
        <div className="demo-actions">{step === 3
          ? <button className="button button-primary" disabled={choice === null} onClick={() => go(4)}>Preview the reveal</button>
          : <Link prefetch={false} className="button button-primary" href={signedIn ? '/challenges/new' : '/login?next=%2Fchallenges%2Fnew'}>Start a real challenge</Link>}</div>
      </>}
      {step > 0 && <div className="demo-actions"><button className="button" onClick={() => go(step - 1)}>Back</button><button className="button" onClick={reset}>Restart practice</button></div>}
    </div>
  </section>;
}
