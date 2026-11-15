'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from './Toast';
import type { Job } from '@/lib/supabase';

const DAYS_BEFORE_NUDGE = 5;

/**
 * מעקב אחרי הגשה.
 *
 * אחרי חמישה ימים בלי תשובה, פנייה קצרה למגייס היא מה שמחזיר מועמדות
 * לראש הערימה, ובג'וניור בלי ניסיון זה בדיוק מה שמבדיל בין להיעלם לבין להיזכר.
 * הטקסט כאן מוכן להעתקה כדי שזה ייקח דקה ולא ייפול בגלל שצריך לנסח.
 */
export function FollowUp({ job }: { job: Job }) {
  const [done, setDone] = useState(!!job.followed_up_at);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const { notify } = useToast();

  const appliedAt = job.applied_at ? new Date(job.applied_at) : null;
  const days = appliedAt ? Math.floor((Date.now() - appliedAt.getTime()) / 86400000) : null;
  const due = !done && days !== null && days >= DAYS_BEFORE_NUDGE;

  const message = [
    `שלום,`,
    ``,
    `הגשתי מועמדות לתפקיד ${job.title}${job.company ? ` ב${job.company}` : ''}${days !== null ? ` לפני ${days} ימים` : ''}, ורציתי לוודא שקורות החיים שלי הגיעו.`,
    ``,
    `התפקיד מעניין אותי במיוחד, ואשמח לדעת מה השלב הבא בתהליך ואם נדרש ממני משהו נוסף.`,
    ``,
    `תודה,`,
    `זיו בכר`,
  ].join('\n');

  async function mark(next: boolean) {
    const prev = done;
    setDone(next);
    setBusy(true);
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, followedUp: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setDone(prev);
        notify('error', 'העדכון נכשל', j.error);
        return;
      }
      notify('success', next ? 'סומן שנשלחה פנייה' : 'סימון המעקב בוטל', job.title);
      router.refresh();
    } catch (e: any) {
      setDone(prev);
      notify('error', 'העדכון נכשל', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      notify('success', 'הטקסט הועתק', 'אפשר לשלוח למגייס');
    } catch {
      notify('error', 'ההעתקה נכשלה', 'אפשר לסמן את הטקסט ולהעתיק ידנית');
    }
  }

  return (
    <div className={`rounded-2xl border p-4 ${due ? 'border-amber/35 bg-amber-soft' : 'border-line bg-paper/60'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-ink">מעקב אחרי ההגשה</h4>
          <p className="mt-1 text-xs leading-relaxed text-body">
            {done
              ? 'סומן שנשלחה פנייה למגייס.'
              : days === null
                ? 'אחרי חמישה ימים בלי תשובה כדאי לשלוח פנייה קצרה.'
                : due
                  ? `עברו ${days} ימים מההגשה בלי תשובה. זה הזמן לפנייה קצרה.`
                  : `עברו ${days} ימים מההגשה. כדאי לפנות אחרי ${DAYS_BEFORE_NUDGE}.`}
          </p>
        </div>
        <button
          onClick={() => mark(!done)}
          disabled={busy}
          aria-pressed={done}
          className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition disabled:opacity-60 ${
            done ? 'border-good bg-good-soft text-good' : 'border-line text-body hover:border-ink hover:text-ink'
          }`}
        >
          {done ? 'נשלחה פנייה' : 'סמני שנשלחה פנייה'}
        </button>
      </div>

      {!done && (
        <>
          <label htmlFor={`fu-${job.id}`} className="mt-3 block text-xs font-bold text-muted">
            נוסח מוכן לשליחה
          </label>
          <textarea
            id={`fu-${job.id}`}
            readOnly
            value={message}
            rows={7}
            className="mt-1.5 w-full resize-y rounded-xl border border-line bg-surface p-3 text-sm leading-relaxed text-body"
          />
          <button
            onClick={copy}
            className="mt-2.5 rounded-xl border border-line bg-surface px-4 py-2 text-xs font-bold text-body transition hover:border-ink hover:text-ink"
          >
            {copied ? 'הועתק' : 'להעתיק את הנוסח'}
          </button>
        </>
      )}
    </div>
  );
}
