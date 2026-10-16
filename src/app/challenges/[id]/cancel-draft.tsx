"use client";
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cancelDraft } from '../moderation-actions';

export default function CancelDraft({ id }: { id: string }) {
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return <section className="draft-cancellation" aria-label="Cancel draft">
    {!confirm ? <button className="button" onClick={() => setConfirm(true)}>Cancel draft</button> : <>
      <p>Cancel this draft? It cannot be resumed or published. Your other challenges stay unchanged.</p>
      <div className="empty-actions"><button className="button" disabled={pending} onClick={() => setConfirm(false)}>Keep draft</button>
      <button className="button" disabled={pending} onClick={() => startTransition(async () => {
        setError('');
        try {
          const result = await cancelDraft(id);
          if (result.error) setError(result.error);
          else { router.replace('/challenges?view=yours'); router.refresh(); }
        } catch { setError('Cancellation did not finish. Please retry.'); }
      })}>{pending ? 'Cancelling…' : 'Yes, cancel draft'}</button></div>
    </>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
