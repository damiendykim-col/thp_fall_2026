"use client";
import { useId, type ReactNode } from 'react';

/** Native popover supports click/tap, keyboard, Escape and light dismiss. */
export default function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return <span className="info-tip">
    <button className="info-trigger" type="button" popoverTarget={id} aria-label={label}>i</button>
    <span className="info-content" id={id} popover="auto"><strong>{label}</strong><span>{children}</span><button type="button" className="button" popoverTarget={id} popoverTargetAction="hide">Close</button></span>
  </span>;
}
