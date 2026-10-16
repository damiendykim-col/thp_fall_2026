import type { ReactNode } from 'react';

export default function WorkStatus({ label, waiting = false, children }: { label: string; waiting?: boolean; children?: ReactNode }) {
  return <div className={`work-status ${waiting ? 'waiting' : 'working'}`} role="status">
    <span className="work-status-visual" aria-hidden="true">{waiting ? '◷' : '✦'}</span>
    <div><strong>{label}</strong>{children && <div className="work-status-detail">{children}</div>}</div>
  </div>;
}
