"use client";
import { useState, useTransition } from "react";
import type { Storyboard } from "@/lib/challenges/gif-types";
export default function FrameReview({ data, onConfirm, onChange, notice }: { data: Storyboard; onConfirm: (frames: number[]) => Promise<boolean>; onChange?: () => void; notice: string }) {
  const [selected,setSelected] = useState(data.selected);
  const [moment,setMoment] = useState(data.selected[0]);
  const [replace,setReplace] = useState(data.selected[0]);
  const [confirmed,setConfirmed] = useState(false);
  const [busy,startTransition] = useTransition();
  const frame=data.frames[moment];
  const changed=JSON.stringify(selected)!==JSON.stringify(data.selected);
  return <section className="challenge-form" aria-busy={busy}>
      <p>The proposed AI input is {selected.length} sampled frames in time order. It may miss quick actions, timing, or brief text. Your selection is for caption context, not a safety approval.</p>
      <h2>Selected moments</h2>
      <p className="muted">These frames are ready to use. Click a thumbnail to inspect it, or open Adjust frames to replace a moment.</p>
      <div className="gif-storyboard">{selected.map(index => <button key={index} type="button" className="gif-frame" disabled={busy} aria-pressed={replace === index} aria-label={`Select storyboard frame ${index + 1}`} onClick={() => { setReplace(index); setMoment(index); }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.frames[index].src} alt="" /><span>{(data.frames[index].startMs / 1000).toFixed(2)}s</span>
      </button>)}</div>
      <button className="button button-primary" type="button" disabled={confirmed || busy} onClick={() => startTransition(async () => { setConfirmed(await onConfirm(selected)); })}>{confirmed ? "Frames confirmed" : "Use these frames"}</button>
      <p className="field-help">{notice}</p>
      <p role="status">{confirmed ? "Frames confirmed." : changed ? "Selection changed. Review and confirm these frames." : "Automatic selection ready to confirm."}</p>
      <details><summary>Adjust frames</summary>
      <div className="challenge-form">
      <p className="muted">Select a thumbnail above, then browse to a different moment and replace that frame.</p>
      <label>Browse moments<input type="range" disabled={busy} min={0} max={data.frames.length - 1} value={moment} onChange={e => setMoment(Number(e.target.value))} /></label>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="gif-moment" src={frame.src} alt={`Frame ${moment + 1} at ${(frame.startMs / 1000).toFixed(2)} seconds`} />
      <p>Frame {moment + 1} of {data.frames.length} · {(frame.startMs / 1000).toFixed(2)}s · held for {frame.durationMs}ms</p>
      <button className="button" type="button" disabled={busy || selected.includes(moment)} onClick={() => {
        setConfirmed(false); onChange?.(); setSelected(selected.map(index => index === replace ? moment : index).sort((a,b) => a-b)); setReplace(moment);
      }}>Replace selected frame</button>
      <p>{selected.includes(moment) ? "This moment is already in the storyboard." : `Replaces the selected frame at ${(data.frames[replace].startMs / 1000).toFixed(2)}s.`}</p>
      <button className="button" type="button" disabled={busy || !changed} onClick={() => { setConfirmed(false); onChange?.(); setSelected(data.selected); setReplace(data.selected[0]); setMoment(data.selected[0]); }}>Reset automatic selection</button>
      </div></details>
  </section>;
}
