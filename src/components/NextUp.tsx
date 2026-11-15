'use client';

import { useState } from 'react';
import { MatchMeter, THRESHOLD } from './MatchMeter';
import { JobDetail } from './JobDetail';
import { Logo } from './Logo';
import { arrival } from './JobCard';
import { sourceLabel } from '@/lib/sources';
import { useJobStatus } from '@/lib/useJobStatus';
import type { Job } from '@/lib/supabase';

/**
 * ההמלצה הראשית: ההחלטה שהמסך משרת (DESIGN.md).
 *
 * קומפוזיציה שונה לגמרי מהגריד, וזה מה שמחזיק את RHYTHM 2: אסימטרי, רחב,
 * והאקסנט היחיד של האתר מופיע כאן ובכפתור ההגשה בלבד.
 */
export function NextUp({ job, resumeCount = 0 }: { job: Job; resumeCount?: number }) {
  const [open, setOpen] = useState(false);
  const { saved, justSaved, busy, set } = useJobStatus(job);
  const a = arrival(job);
  const strong = (job.score ?? 0) >= THRESHOLD;

  return (
    <>
      <section className="mt-8" aria-labelledby="nextup-heading">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="nextup-heading" className="font-display text-sm font-bold text-accent-ink">
            {strong ? 'המשרה להגיש אליה עכשיו' : 'ההתאמה הטובה ביותר שנותרה'}
          </h2>
          {a.fresh && <span className="text-xs font-bold text-flame">נקלטה בשלוש השעות האחרונות</span>}
        </div>

        <div className="mt-3 overflow-hidden rounded-4xl border border-accent/25 bg-surface shadow-hero">
          <div className="grid gap-0 md:grid-cols-[1.6fr_1fr]">
            {/* הצד שמסביר למה דווקא היא */}
            <div className="p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <Logo job={job} large />
                <div className="min-w-0">
                  <h3 className="font-display text-2xl font-bold leading-tight text-ink sm:text-3xl">
                    <button onClick={() => setOpen(true)} className="text-right transition hover:text-accent-ink">
                      {job.title}
                    </button>
                  </h3>
                  {job.company && <p className="mt-1.5 font-semibold text-accent-ink">{job.company}</p>}
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {[job.location, job.scope, job.experience].filter(Boolean).map((m) => (
                      <span key={m as string} className="rounded-lg bg-paper px-2 py-0.5 text-xs text-body">{m}</span>
                    ))}
                  </div>
                </div>
              </div>

              {job.summary && <p className="mt-5 leading-relaxed text-body">{job.summary}</p>}

              {!!job.score_reasons?.strengths?.length && (
                <ul className="mt-4 space-y-1.5 text-sm text-body">
                  {job.score_reasons.strengths.slice(0, 3).map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-good" aria-hidden="true" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => setOpen(true)}
                  className="rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white transition hover:bg-accent-ink"
                >
                  לקרוא את המשרה ולהחליט
                </button>
                <button
                  onClick={() => set(saved ? 'new' : 'saved')}
                  disabled={busy}
                  aria-pressed={saved}
                  className={`rounded-xl border px-4 py-3 text-sm font-bold transition disabled:opacity-50 ${
                    saved ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line text-body hover:border-ink hover:text-ink'
                  } ${justSaved ? 'pop' : ''}`}
                >
                  {saved ? 'שמורה' : 'לשמור לאחר כך'}
                </button>
                <button
                  onClick={() => set('applied')}
                  disabled={busy}
                  className="rounded-xl border border-line px-4 py-3 text-sm font-bold text-body transition hover:border-ink hover:text-ink disabled:opacity-50"
                >
                  כבר הגשתי
                </button>
              </div>
            </div>

            {/* הצד שמודד. המוטיב בגודל מלא. */}
            <div className="border-t border-line bg-paper/70 p-6 sm:p-8 md:border-r md:border-t-0">
              <MatchMeter score={job.score} size="lg" />

              {job.ats_score !== null && (
                <dl className="mt-5 space-y-2.5 text-sm">
                  <Row label="ציון ATS" value={job.ats_score} />
                  <Row label="ציון מגייס" value={job.hr_score} />
                </dl>
              )}

              {!!job.key_requirements?.length && (
                <div className="mt-5">
                  <h4 className="text-xs font-bold text-muted">דרישות מרכזיות</h4>
                  <ul className="mt-1.5 space-y-1 text-sm leading-relaxed text-body">
                    {job.key_requirements.slice(0, 4).map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}

              <p className="mt-5 text-xs text-muted">נקלטה {a.label} · מתוך {sourceLabel(job.source)}</p>
            </div>
          </div>
        </div>
      </section>

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

function Row({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
      <dt className="text-muted">{label}</dt>
      <dd className="font-display text-base font-bold text-ink">{value ?? '—'}</dd>
    </div>
  );
}
