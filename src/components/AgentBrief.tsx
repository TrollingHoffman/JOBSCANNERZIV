'use client';

import { useState } from 'react';
import { useToast } from './Toast';

type Brief = {
  brief: string;
  must_have: string[];
  nice_to_have: string[];
  do_not_claim: string[];
  cached?: boolean;
};

/**
 * "כללי המפתח לסוכן" (בקשה מפורשת של אמית).
 *
 * זיו לוחצת, מקבלת בלוק טקסט אחד, ומעתיקה אותו לסוכן שהיא עובדת איתו.
 * היא לא תלויה באתר הזה בשביל לשפר את קורות החיים.
 */
export function AgentBrief({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { notify } = useToast();

  async function load(refresh = false) {
    setLoading(true);
    try {
      const res = await fetch('/api/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, refresh }),
      });
      const j = await res.json();
      if (!res.ok) { notify('error', 'יצירת הכללים נכשלה', j.error); return; }
      setData(j);
      setOpen(true);
      if (refresh) notify('success', 'הכללים נוצרו מחדש', jobTitle);
    } catch (e: any) {
      notify('error', 'יצירת הכללים נכשלה', String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!data?.brief) return;
    try {
      await navigator.clipboard.writeText(data.brief);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      notify('success', 'הכללים הועתקו', 'אפשר להדביק אצל הסוכן');
    } catch {
      notify('error', 'ההעתקה נכשלה', 'אפשר לסמן את הטקסט ולהעתיק ידנית');
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => load(false)}
        disabled={loading}
        className="rounded-xl border border-accent/40 bg-accent-soft px-4 py-2.5 text-sm font-bold text-accent-ink transition hover:border-accent disabled:opacity-60"
      >
        {loading ? 'מכין את הכללים...' : 'כללי מפתח לסוכן'}
      </button>
    );
  }

  return (
    <div className="panel-open w-full rounded-2xl border border-accent/25 bg-accent-soft/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-display text-base font-bold text-ink">כללי מפתח להעברה לסוכן</h4>
          <p className="mt-1 text-xs leading-relaxed text-body">
            הבלוק הזה נכתב כדי להעביר אותו לסוכן שזיו עובדת איתו. הוא כולל במפורש מה אסור לטעון,
            כדי שהסוכן לא ימציא ניסיון שאין.
          </p>
        </div>
        <button onClick={() => setOpen(false)} className="text-xs font-bold text-muted underline">סגירה</button>
      </div>

      {!!data?.do_not_claim?.length && (
        <div className="mt-4 rounded-xl border border-amber/30 bg-amber-soft p-3">
          <p className="text-xs font-bold text-amber">אסור לטעון שיש לזיו</p>
          <p className="mt-1 text-sm text-body">{data.do_not_claim.join(' · ')}</p>
        </div>
      )}

      <label htmlFor={`brief-${jobId}`} className="mt-4 block text-xs font-bold text-muted">
        הטקסט להעתקה
      </label>
      <textarea
        id={`brief-${jobId}`}
        readOnly
        value={data?.brief ?? ''}
        rows={14}
        className="mt-1.5 w-full resize-y rounded-xl border border-line bg-surface p-3 font-sans text-sm leading-relaxed text-body"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <button
          onClick={copy}
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white transition hover:bg-accent-ink"
        >
          {copied ? 'הועתק' : 'להעתיק את הכללים'}
        </button>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-body transition hover:border-ink hover:text-ink disabled:opacity-60"
        >
          {loading ? 'מייצר מחדש...' : 'לייצר מחדש'}
        </button>
        {data?.cached && <span className="text-xs text-muted">נוצרו בעבר ונשמרו</span>}
      </div>
    </div>
  );
}
