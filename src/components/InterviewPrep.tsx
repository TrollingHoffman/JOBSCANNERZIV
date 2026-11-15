'use client';

import { useState } from 'react';
import { useToast } from './Toast';

type Question = { question: string; why: string; outline: string[] };
type Prep = { questions: Question[]; ask_them: string[]; cached?: boolean };

/**
 * הכנה לראיון. נפתחת רק אחרי שזיו סימנה שהגישה, כי לפני זה אין מה להתכונן אליו.
 */
export function InterviewPrep({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const [data, setData] = useState<Prep | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openQ, setOpenQ] = useState<number | null>(0);
  const { notify } = useToast();

  async function load(refresh = false) {
    setLoading(true);
    try {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, refresh }),
      });
      const j = await res.json();
      if (!res.ok) { notify('error', 'ההכנה לראיון נכשלה', j.error); return; }
      setData(j);
      setOpen(true);
      if (refresh) notify('success', 'ההכנה נוצרה מחדש', jobTitle);
    } catch (e: any) {
      notify('error', 'ההכנה לראיון נכשלה', String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => load(false)}
        disabled={loading}
        className="rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-body transition hover:border-ink hover:text-ink disabled:opacity-60"
      >
        {loading ? 'מכין שאלות...' : 'הכנה לראיון'}
      </button>
    );
  }

  return (
    <div className="panel-open w-full rounded-2xl border border-line bg-paper/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-display text-base font-bold text-ink">הכנה לראיון</h4>
          <p className="mt-1 text-xs leading-relaxed text-body">
            השאלות נגזרו מהדרישות של המשרה הזו, וראשי הפרקים מורכבים רק ממה שכתוב בקורות החיים.
          </p>
        </div>
        <button onClick={() => setOpen(false)} className="text-xs font-bold text-muted underline">סגירה</button>
      </div>

      <ul className="mt-4 space-y-2">
        {(data?.questions ?? []).map((q, i) => (
          <li key={i} className="overflow-hidden rounded-xl border border-line bg-surface">
            <button
              onClick={() => setOpenQ(openQ === i ? null : i)}
              aria-expanded={openQ === i}
              className="flex w-full items-start gap-3 p-3.5 text-right transition hover:bg-paper/60"
            >
              <span className="mt-0.5 shrink-0 font-display text-sm font-bold text-accent-ink">{i + 1}</span>
              <span className="flex-1 text-sm font-semibold leading-relaxed text-ink">{q.question}</span>
              <span className="mt-1 shrink-0 text-muted" aria-hidden="true">{openQ === i ? '−' : '+'}</span>
            </button>
            {openQ === i && (
              <div className="border-t border-line px-3.5 py-3">
                {q.why && <p className="text-xs text-muted">נובעת מ: {q.why}</p>}
                <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-body">
                  {(q.outline ?? []).map((o, k) => (
                    <li key={k} className="flex gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent/60" aria-hidden="true" />
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>

      {!!data?.ask_them?.length && (
        <div className="mt-4 rounded-xl border border-good/25 bg-good-soft p-3.5">
          <p className="text-xs font-bold text-good">שאלות שכדאי שזיו תשאל אותם</p>
          <ul className="mt-1.5 space-y-1 text-sm text-body">
            {data.ask_them.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}

      <button
        onClick={() => load(true)}
        disabled={loading}
        className="mt-4 rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-body transition hover:border-ink hover:text-ink disabled:opacity-60"
      >
        {loading ? 'מייצר מחדש...' : 'לייצר מחדש'}
      </button>
    </div>
  );
}
