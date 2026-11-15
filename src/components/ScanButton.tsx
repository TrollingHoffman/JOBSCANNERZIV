'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from './Toast';

/**
 * סריקה וניתוח. הניתוח רץ במחזורים עד שלא נשארה משרה ללא ציון.
 */
export function ScanButton({ pending = 0 }: { pending?: number }) {
  const [busy, setBusy] = useState<'' | 'scan' | 'analyze'>('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const router = useRouter();
  const { notify } = useToast();

  async function scan() {
    setBusy('scan');
    notify('info', 'הסריקה התחילה', 'עובר על כל החיפושים הפעילים');
    try {
      const res = await fetch('/api/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'הסריקה נכשלה');
      notify(
        'success',
        json.new_jobs ? `הסריקה הסתיימה · ${json.new_jobs} משרות חדשות` : 'הסריקה הסתיימה · אין חדשות',
        `נסרקו ${json.found} משרות · ${json.reposts} פרסום חוזר · ${json.emailed} נשלחו במייל`
      );
      if (json.error) notify('error', 'אזהרה במהלך הסריקה', json.error);
      router.refresh();
    } catch (e: any) {
      notify('error', 'הסריקה נכשלה', e.message);
    } finally {
      setBusy('');
    }
  }

  async function analyzeAll() {
    setBusy('analyze');
    const total = pending;
    let cumulative = 0;
    setProgress({ done: 0, total });
    notify('info', 'הניתוח התחיל', `${total} משרות בתור`);

    try {
      for (let round = 0; round < 20; round++) {
        const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'הניתוח נכשל');

        cumulative += json.analyzed ?? 0;
        setProgress({ done: cumulative, total });
        router.refresh();

        if (json.done || (json.analyzed ?? 0) === 0) {
          notify('success', 'הניתוח הסתיים', `${cumulative} משרות קיבלו ציון${json.remaining ? ` · ${json.remaining} נשארו` : ''}`);
          break;
        }
      }
    } catch (e: any) {
      notify('error', 'הניתוח נכשל', e.message);
    } finally {
      setBusy('');
      setProgress(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pending > 0 && (
        <button onClick={analyzeAll} disabled={busy !== ''} className="rounded-xl border border-white/25 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-50">
          {busy === 'analyze'
            ? progress ? `מנתח ${progress.done} מתוך ${progress.total}…` : 'מנתח…'
            : `נתח ${pending} משרות ללא ציון`}
        </button>
      )}
      <button onClick={scan} disabled={busy !== ''} className="inline-flex items-center gap-2 rounded-xl bg-signal px-5 py-2.5 text-sm font-bold text-night transition hover:brightness-105 disabled:opacity-60">
        {busy === 'scan' ? (<><span className="h-2 w-2 animate-ping rounded-full bg-night" />סורק…</>) : 'סריקה עכשיו'}
      </button>
    </div>
  );
}
