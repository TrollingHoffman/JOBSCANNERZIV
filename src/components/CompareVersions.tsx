'use client';

import { useState } from 'react';
import { useToast } from './Toast';

type Row = { resume_id: string; label: string; score: number; ats_score: number; hr_score: number; rating: string; strengths: string[]; gaps: string[] };

export function CompareVersions({ jobId }: { jobId: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [rows, setRows] = useState<Row[]>([]);
  const [verdict, setVerdict] = useState('');
  const [error, setError] = useState('');
  const { notify } = useToast();

  async function run(force = false) {
    setState('loading');
    try {
      const res = await fetch('/api/compare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId, force }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'ההשוואה נכשלה');
      setRows(json.results ?? []);
      setVerdict(json.verdict ?? '');
      setState('done');
      notify('success', 'ההשוואה הושלמה', json.verdict);
    } catch (e: any) {
      setError(e.message);
      setState('error');
      notify('error', 'ההשוואה נכשלה', e.message);
    }
  }

  if (state === 'idle') return <button onClick={() => run()} className="rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-body transition hover:border-accent hover:text-accent">איזו גרסה לשלוח?</button>;
  if (state === 'loading') return <p className="flex items-center gap-2 text-sm text-muted"><span className="h-2 w-2 animate-ping rounded-full bg-accent" />מנקד את הגרסאות…</p>;
  if (state === 'error') return (
    <div className="w-full rounded-2xl border border-danger/25 bg-danger-soft p-4 text-sm">
      <p className="font-bold text-danger">{error}</p>
      <button onClick={() => run()} className="mt-2 font-bold text-accent underline">לנסות שוב</button>
    </div>
  );

  const best = rows[0]?.resume_id;
  return (
    <div className="panel-open w-full border-t border-line pt-5">
      <h4 className="mb-1 font-display text-base font-bold text-ink">השוואת גרסאות</h4>
      {verdict && <p className="mb-3 text-sm text-body">{verdict}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.resume_id} className={`rounded-2xl border p-4 ${r.resume_id === best ? 'border-accent bg-accent-soft' : 'border-line bg-paper/60'}`}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-bold text-ink">{r.label}</p>
              <span className="font-display text-2xl font-bold text-accent">{r.score}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted">ATS {r.ats_score} · HR {r.hr_score} · {r.rating}</p>
          </div>
        ))}
      </div>
      <button onClick={() => run(true)} className="mt-3 text-xs font-bold text-muted underline">לחשב מחדש</button>
    </div>
  );
}
