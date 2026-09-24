"use client";

import { useEffect, useRef, useState } from "react";
import type { GalleryImage } from "@/lib/images";

function MemeImage({ image }: { image: GalleryImage }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <span className="image-fallback">This image couldn’t load.</span>;
  // Native images preserve animated GIFs without an image optimization service.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={image.image_url} alt={image.description?.trim() || "Community meme"} loading="lazy" onError={() => setBroken(true)} />;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toISOString().slice(0, 16).replace("T", " ");
}

export default function Gallery({ images }: { images: GalleryImage[] }) {
  const [view, setView] = useState<"cards" | "list" | "table">("cards");
  const [sort, setSort] = useState("newest");
  const [activeId, setActiveId] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const sorted = [...images].sort((a, b) => {
    const difference = Date.parse(b.created_at) - Date.parse(a.created_at);
    return sort === "newest" ? difference : -difference;
  });
  const activeIndex = sorted.findIndex((image) => image.id === activeId);
  const active = sorted[activeIndex];
  useEffect(() => {
    if (!activeId) return;
    dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [activeId]);
  function close() { dialog.current?.close(); setActiveId(null); }
  function step(direction: number) {
    if (sorted.length) setActiveId(sorted[(activeIndex + direction + sorted.length) % sorted.length].id);
  }
  return <>
    <div className="feed-toolbar">
      <div className="feed-title"><h1>Images</h1><span className="count">{images.length} {images.length === 1 ? "image" : "images"}</span></div>
      <div className="feed-controls">
        <div className="view-switch" role="group" aria-label="Image layout">
          {(["cards", "list", "table"] as const).map((layout) => <button key={layout} aria-pressed={view === layout} onClick={() => setView(layout)}>{layout[0].toUpperCase() + layout.slice(1)}</button>)}
        </div>
      {images.length > 0 && <label className="sort-label">Sort by <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>}
      </div>
    </div>
    {images.length === 0 ? <div className="status-panel"><h3>No images yet.</h3><p>Images will appear here when they are added.</p></div> :
      view === "table" ? <div className="table-scroll">
        <table className="image-table">
          <caption className="sr-only">Images from the gallery</caption>
          <thead><tr><th scope="col">Image</th><th scope="col">Description</th><th scope="col">Added (UTC)</th><th scope="col">ID</th></tr></thead>
          <tbody>{sorted.map((image, index) => <tr key={image.id}>
            <td><button className="thumbnail-button" onClick={() => setActiveId(image.id)} aria-label={`Open image ${index + 1}`}><MemeImage image={image} /></button></td>
            <td>{image.description?.trim() || <span className="muted">—</span>}</td>
            <td><time dateTime={image.created_at}>{formatDate(image.created_at)}</time></td>
            <td className="record-id">{image.id}</td>
          </tr>)}</tbody>
        </table>
      </div> : <ul className={view === "cards" ? "image-grid" : "image-list"}>{sorted.map((image, index) =>
        <li className="meme-card" key={image.id}>
          <button className="card-button" onClick={() => setActiveId(image.id)} aria-label={`Open image ${index + 1}${image.description?.trim() ? `: ${image.description.trim()}` : ""}`}>
            <span className="image-frame"><MemeImage image={image} /></span>
          </button>
          {view === "list" ? <div className="list-details">
            <p>{image.description?.trim() || "Untitled image"}</p>
            <time dateTime={image.created_at}>{formatDate(image.created_at)} UTC</time>
          </div> : image.description?.trim() && <p className="card-description">{image.description}</p>}
        </li>
      )}</ul>}
    <dialog ref={dialog} className="image-dialog" aria-label="Expanded image" onClose={() => setActiveId(null)} onClick={(event) => { if (event.target === event.currentTarget) close(); }} onKeyDown={(event) => {
      if (event.key === "ArrowRight") { event.preventDefault(); step(1); }
      if (event.key === "ArrowLeft") { event.preventDefault(); step(-1); }
    }}>
      {active && <div className="viewer-content">
        <div className="viewer-header"><span>Image {activeIndex + 1} of {sorted.length}</span><button className="button" onClick={close} autoFocus aria-label="Close image">Close ×</button></div>
        <div className="viewer-image"><MemeImage key={active.id} image={active} /></div>
        {active.description?.trim() && <p>{active.description}</p>}
        <div className="viewer-controls"><button className="button" onClick={() => step(-1)} disabled={sorted.length < 2}>← Previous</button><button className="button" onClick={() => step(1)} disabled={sorted.length < 2}>Next →</button></div>
      </div>}
    </dialog>
  </>;
}
