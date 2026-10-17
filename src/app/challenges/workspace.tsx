"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

export default function ChallengeWorkspace({ create, browse }: { create: ReactNode; browse: ReactNode }) {
  const params = useSearchParams();
  const creating = params.get("mode") === "create";
  function select(mode: "create" | "browse") {
    const url = new URL(window.location.href);
    if (mode === "create") url.searchParams.set("mode", "create");
    else url.searchParams.delete("mode");
    window.history.pushState(null, "", url.pathname + url.search);
  }
  return <>
    <div className="challenge-tabs" role="group" aria-label="Challenge workspace">
      <button className={creating ? "workspace-selected" : ""} aria-pressed={creating} aria-controls="create-panel" onClick={() => select("create")}>Create</button>
      <button className={!creating ? "workspace-selected" : ""} aria-pressed={!creating} aria-controls="browse-panel" onClick={() => select("browse")}>Browse</button>
    </div>
    {/* Keep the form mounted: switching preserves files, in-flight work and step. */}
    <section id="create-panel" hidden={!creating} aria-label="Create a challenge">{create}</section>
    <section id="browse-panel" hidden={creating} aria-label="Browse challenges">{browse}</section>
  </>;
}
