'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MatchMeter } from './MatchMeter';
import { JobDetail } from './JobDetail';
import { Logo } from './Logo';
import { SourceLine } from './SourceLine';
import { useToast } from './Toast';
import { arrival } from './JobCard';
import type { Job } from '@/lib/supabase';

type Decision = 'saved' | 'dismissed' | 'skip';

/**
 * מעבר על המשרות, אחת אחת.
 *
 * הבעיה שזה פותר: היו 162 משרות שזיו לא נגעה בהן, 81 מהן מעל הסף, ושמורה אחת.
 * הכלי מצא הרבה, ואי אפשר היה לעבור על זה. הסיבה היא שלא הייתה דרך להגיד
 * "לא בשבילי", ולכן הרשימה רק גדלה ולעולם לא הצטמצמה.
 *
 * כאן יש החלטה אחת כל פעם ושלוש אפשרויות, והתור מתקצר.
 *
 * אין אנימציה על מעבר בין משרות. פעולה שחוזרת עשרות פעמים ברצף, ובמיוחד
 * כזו שמופעלת מהמקלדת, חייבת להיות מיידית. אנימציה כאן גורמת לכלי להרגיש
 * אטי בדיוק ברגע שבו הוא אמור להרגיש מהיר.
 */
export function ReviewDeck({ jobs, resumeCount }: { jobs: Job[]; resumeCount: number }) {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ saved: number; dismissed: number }>({ saved: 0, dismissed: 0 });
  const router = useRouter();
  const { notify } = useToast();
  const liveRef = useRef<HTMLParagraphElement>(null);

  const job = jobs[i];
  const remaining = jobs.length - i;

  async function decide(d: Decision) {
    if (!job || busy) return;

    if (d === 'skip') {
      setI((n) => n + 1);
      return;
    }

    setBusy(true);
    // התקדמות מיידית. ההחלטה נשמרת ברקע, כי להמתין לשרת בין משרה
    // למשרה הופך מעבר על 80 משרות לבלתי אפשרי.
    setI((n) => n + 1);
    setDone((p) => ({ ...p, [d === 'saved' ? 'saved' : 'dismissed']: p[d === 'saved' ? 'saved' : 'dismissed'] + 1 }));

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, status: d }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        notify('error', 'ההחלטה לא נשמרה', `${job.title}: ${j.error ?? res.status}`);
      }
    } catch (e: any) {
      notify('error', 'ההחלטה לא נשמרה', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (open) return;
      const el = document.activeElement;
      if (el && /INPUT|TEXTAREA|SELECT/.test(el.tagName)) return;

      if (e.key === 'ArrowRight' || e.key === '1') { e.preventDefault(); decide('saved'); }
      else if (e.key === 'ArrowLeft' || e.key === '2') { e.preventDefault(); decide('dismissed'); }
      else if (e.key === 'ArrowDown' || e.key === '3') { e.preventDefault(); decide('skip'); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!job) {
    return (
      <div className="mt-10 rounded-3xl border border-line bg-surface p-12 text-center">
        <p className="font-display text-2xl font-bold text-ink">עברת על הכל</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-body">
          {done.saved > 0 || done.dismissed > 0
            ? `שמרת ${done.saved} ודילגת על ${done.dismissed}. המשרות ששמרת מחכות ברשימה.`
            : 'אין כרגע משרות חדשות לעבור עליהן. הסריקה רצה כל שעה.'}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <Link href="/?view=saved" className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white transition hover:bg-accent-ink">
            למשרות ששמרת
          </Link>
          <Link href="/" className="rounded-xl border border-line px-5 py-2.5 text-sm font-bold text-body transition hover:border-ink hover:text-ink">
            לכל המשרות
          </Link>
        </div>
      </div>
    );
  }

  const a = arrival(job);

  return (
    <>
      <div className="mt-6">
        {/* כמה נשאר. בלי זה אין תחושה של התקדמות, ו-80 משרות מרגישות אינסופיות. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-body">
            נשארו <span className="font-display text-lg text-ink">{remaining}</span> משרות לעבור עליהן
          </p>
          {(done.saved > 0 || done.dismissed > 0) && (
            <p className="text-xs text-muted">שמרת {done.saved} · דילגת על {done.dismissed}</p>
          )}
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
            style={{ width: `${(i / jobs.length) * 100}%` }}
          />
        </div>

        <p ref={liveRef} className="sr-only" aria-live="polite">
          משרה {i + 1} מתוך {jobs.length}: {job.title}
        </p>

        <article className="mt-5 rounded-4xl border border-line bg-surface p-6 shadow-card sm:p-8">
          <div className="flex items-start gap-4">
            <Logo job={job} large />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-2xl font-bold leading-tight text-ink sm:text-3xl">{job.title}</h2>
              {job.company && <p className="mt-1.5 font-semibold text-accent-ink">{job.company}</p>}
              <SourceLine job={job} className="mt-1.5" />
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {[job.location, job.scope, job.experience].filter(Boolean).map((m) => (
                  <span key={m as string} className="rounded-lg bg-paper px-2 py-0.5 text-xs text-body">{m}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-paper/70 p-4">
            <MatchMeter score={job.score} size="lg" />
          </div>

          {job.summary && <p className="mt-5 leading-relaxed text-body">{job.summary}</p>}

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {!!job.score_reasons?.strengths?.length && (
              <div>
                <h3 className="text-xs font-bold text-good">למה זה מתאים</h3>
                <ul className="mt-1.5 space-y-1 text-sm leading-relaxed text-body">
                  {job.score_reasons.strengths.slice(0, 3).map((s, k) => <li key={k}>{s}</li>)}
                </ul>
              </div>
            )}
            {!!job.key_requirements?.length && (
              <div>
                <h3 className="text-xs font-bold text-muted">דרישות מרכזיות</h3>
                <ul className="mt-1.5 space-y-1 text-sm leading-relaxed text-body">
                  {job.key_requirements.slice(0, 3).map((r, k) => <li key={k}>{r}</li>)}
                </ul>
              </div>
            )}
          </div>

          <p className="mt-5 text-xs text-muted">נקלטה {a.label}</p>

          <div className="mt-6 flex flex-wrap items-center gap-2.5 border-t border-line pt-5">
            <button
              onClick={() => decide('saved')}
              className="rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white transition hover:bg-accent-ink"
            >
              מעניין אותי
            </button>
            <button
              onClick={() => decide('dismissed')}
              className="rounded-xl border border-line px-5 py-3 text-sm font-bold text-body transition hover:border-ink hover:text-ink"
            >
              לא בשבילי
            </button>
            <button
              onClick={() => decide('skip')}
              className="rounded-xl border border-line px-4 py-3 text-sm font-bold text-muted transition hover:border-ink hover:text-ink"
            >
              להחליט אחר כך
            </button>
            <button
              onClick={() => setOpen(true)}
              className="rounded-xl px-4 py-3 text-sm font-bold text-accent-ink underline"
            >
              לקרוא את כל המשרה
            </button>
          </div>

          <p className="mt-4 hidden text-xs text-muted sm:block">
            מקלדת: <kbd className="rounded border border-line bg-paper px-1.5 py-0.5">→</kbd> מעניין ·{' '}
            <kbd className="rounded border border-line bg-paper px-1.5 py-0.5">←</kbd> לא בשבילי ·{' '}
            <kbd className="rounded border border-line bg-paper px-1.5 py-0.5">↓</kbd> אחר כך ·{' '}
            <kbd className="rounded border border-line bg-paper px-1.5 py-0.5">Enter</kbd> לקרוא הכל
          </p>
        </article>
      </div>

      {open && (
        <JobDetail
          job={job}
          resumeCount={resumeCount}
          onClose={() => setOpen(false)}
          arrivalLabel={a.label}
          fresh={a.fresh}
        />
      )}
    </>
  );
}
