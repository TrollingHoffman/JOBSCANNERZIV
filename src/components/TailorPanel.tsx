'use client';

import { useState } from 'react';
import { useToast } from './Toast';

type Tailoring = {
  headline: string | null; summary: string | null;
  edits: { section: string; current: string; suggested: string; why: string }[];
  add_keywords: string[]; gaps: string[]; cover_letter: string | null;
};

export function TailorPanel({ jobId }: { jobId: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [data, setData] = useState<Tailoring | null>(null);
  const [error, setError] = useState('');
  const { notify } = useToast();

  async function run(force = false) {
    setState('loading');
    setError('');
    try {
      const res = await fetch('/api/tailor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId, force }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'משהו השתבש');
      setData(json);
      setState('done');
      notify('success', 'ההתאמה מוכנה', 'חידודים, מונחים חסרים ומכתב מקדים');
    } catch (e: any) {
      setError(e.message);
      setState('error');
      notify('error', 'ההתאמה נכשלה', e.message);
    }
  }

  if (state === 'idle') return <button onClick={() => run()} className="rounded-xl bg-night px-5 py-2.5 text-sm font-bold text-white transition hover:bg-accent">התאמת קורות חיים</button>;
  if (state === 'loading') return <p className="flex items-center gap-2 text-sm text-muted" aria-live="polite"><span className="h-2 w-2 animate-ping rounded-full bg-accent" />בונה את ההתאמה…</p>;
  if (state === 'error') return (
    <div className="w-full rounded-2xl border border-danger/25 bg-danger-soft p-4 text-sm">
      <p className="font-bold text-danger">{error}</p>
      <button onClick={() => run()} className="mt-2 font-bold text-accent underline">לנסות שוב</button>
    </div>
  );

  return (
    <div className="panel-open w-full space-y-5 border-t border-line pt-5 text-sm">
      {data?.headline && <Block title="כותרת מוצעת"><Copyable text={data.headline} /></Block>}
      {data?.summary && <Block title="פסקת פתיחה מוצעת"><Copyable text={data.summary} /></Block>}
      {!!data?.edits?.length && (
        <Block title="חידודים לניסוח">
          <ul className="space-y-3">
            {data.edits.map((e, i) => (
              <li key={i} className="rounded-2xl border border-line bg-paper/60 p-4">
                <p className="font-bold text-ink">{e.section}</p>
                <p className="mt-2 rounded-lg bg-white/70 p-2.5 text-muted line-through decoration-1">{e.current}</p>
                <p className="mt-2 rounded-lg bg-accent-soft p-2.5 leading-relaxed text-ink">{e.suggested}</p>
                <p className="mt-2 text-xs text-muted">{e.why}</p>
                <Copyable text={e.suggested} compact />
              </li>
            ))}
          </ul>
        </Block>
      )}
      {!!data?.add_keywords?.length && (
        <Block title="מונחים שחסרים">
          <div className="flex flex-wrap gap-1.5">{data.add_keywords.map((k) => <span key={k} className="rounded-full border border-amber/30 bg-amber-soft px-3 py-1 text-xs font-medium text-amber">{k}</span>)}</div>
        </Block>
      )}
      {!!data?.gaps?.length && <Block title="פערים מול הדרישות"><ul className="list-disc space-y-1 ps-5 text-body">{data.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul></Block>}
      {data?.cover_letter && <Block title="מכתב מקדים"><Copyable text={data.cover_letter} /></Block>}
      <button onClick={() => run(true)} className="text-xs font-bold text-muted underline">לייצר גרסה חדשה</button>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h4 className="mb-2 font-display text-base font-bold text-ink">{title}</h4>{children}</section>;
}

function Copyable({ text, compact }: { text: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const { notify } = useToast();
  return (
    <div className={compact ? 'mt-2' : ''}>
      {!compact && <p className="rounded-2xl border border-line bg-paper/60 p-4 leading-relaxed text-ink">{text}</p>}
      <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); notify('success', 'הועתק ללוח'); setTimeout(() => setCopied(false), 1600); }} className={`mt-2 text-xs font-bold text-accent underline ${copied ? 'pop' : ''}`}>
        {copied ? 'הועתק' : 'העתקה'}
      </button>
    </div>
  );
}
