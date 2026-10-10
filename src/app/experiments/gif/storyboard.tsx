"use client";
import { useEffect, useState, useTransition } from "react";
import { inspectGif, type Storyboard } from "./actions";
import { MAX_CHALLENGE_UPLOAD_BYTES } from "@/lib/challenges/upload-limits";

export default function GifStoryboard() {
  const [data, setData] = useState<Storyboard>();
  const [selected, setSelected] = useState<number[]>([]);
  const [moment, setMoment] = useState(0);
  const [replace, setReplace] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const changed = data && JSON.stringify(selected) !== JSON.stringify(data.selected);
  const frame = data?.frames[moment];
  return <section className="challenge-form" aria-busy={pending}>
    <label>GIF to review<input aria-label="GIF to review" type="file" accept="image/gif" disabled={pending} onChange={e => {
      const file = e.target.files?.[0];
      setConfirmed(false); setData(undefined); setSelected([]); setMoment(0); setReplace(0); setError(""); setPreview("");
      if (!file) return;
      if (file.size > MAX_CHALLENGE_UPLOAD_BYTES) { setError("Choose a GIF up to 3 MB."); return; }
      setPreview(URL.createObjectURL(file));
      startTransition(async () => {
        try {
          const form = new FormData(); form.set("image", file);
          const result = await inspectGif(form);
          setError(result.error ?? ""); setData(result.storyboard); setSelected(result.storyboard?.selected ?? []);
        } catch { setError("The local preview could not finish. Try again with a smaller GIF."); }
      });
    }} /><span className="field-help">Up to 3 MB, 120 frames, and 30 seconds. Processed only by your local app.</span></label>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {preview && <details><summary>Play original animation</summary><img className="challenge-image" src={preview} alt="Original GIF animation" /></details>}
    {pending && <p role="status">Preparing the storyboard…</p>}
    {error && <p role="alert">{error}</p>}
    {data && frame && <>
      <p>The proposed AI input is {selected.length} sampled frames in time order. It may miss quick actions, timing, or brief text. Your selection is for caption context, not a safety approval.</p>
      <h2>Selected moments</h2>
      <p className="muted">These frames are ready to use. Click a thumbnail to inspect it, or open Adjust frames to replace a moment.</p>
      <div className="gif-storyboard">{selected.map(index => <button key={index} type="button" className="gif-frame" aria-pressed={replace === index} aria-label={`Select storyboard frame ${index + 1}`} onClick={() => { setReplace(index); setMoment(index); }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.frames[index].src} alt="" /><span>{(data.frames[index].startMs / 1000).toFixed(2)}s</span>
      </button>)}</div>
      <button className="button button-primary" type="button" disabled={confirmed} onClick={() => setConfirmed(true)}>{confirmed ? "Frames confirmed" : "Use these frames"}</button>
      <p className="field-help">Confirms this local preview only. It does not generate a caption or create a challenge.</p>
      <p role="status">{confirmed ? "Frames confirmed for this local preview." : changed ? "Selection changed. Review and confirm these frames." : "Automatic selection ready to confirm."}</p>
      <details><summary>Adjust frames</summary>
      <div className="challenge-form">
      <p className="muted">Select a thumbnail above, then browse to a different moment and replace that frame.</p>
      <label>Browse moments<input type="range" min={0} max={data.frames.length - 1} value={moment} onChange={e => setMoment(Number(e.target.value))} /></label>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="gif-moment" src={frame.src} alt={`Frame ${moment + 1} at ${(frame.startMs / 1000).toFixed(2)} seconds`} />
      <p>Frame {moment + 1} of {data.frames.length} · {(frame.startMs / 1000).toFixed(2)}s · held for {frame.durationMs}ms</p>
      <button className="button" type="button" disabled={selected.includes(moment)} onClick={() => {
        setConfirmed(false); setSelected(selected.map(index => index === replace ? moment : index).sort((a,b) => a-b)); setReplace(moment);
      }}>Replace selected frame</button>
      <p>{selected.includes(moment) ? "This moment is already in the storyboard." : `Replaces the selected frame at ${(data.frames[replace].startMs / 1000).toFixed(2)}s.`}</p>
      <button className="button" type="button" disabled={!changed} onClick={() => { setConfirmed(false); setSelected(data.selected); setReplace(data.selected[0]); setMoment(data.selected[0]); }}>Reset automatic selection</button>
      </div></details>
    </>}
  </section>;
}
