'use client';

import { useEffect, useRef } from 'react';
import { MatchMeter } from './MatchMeter';
import { TailorPanel } from './TailorPanel';
import { CompareVersions } from './CompareVersions';
import { AgentBrief } from './AgentBrief';
import { InterviewPrep } from './InterviewPrep';
import { FollowUp } from './FollowUp';
import { Logo } from './Logo';
import { SourceLine } from './SourceLine';
import { useJobStatus } from '@/lib/useJobStatus';
import type { Job } from '@/lib/supabase';

/**
 * הפופאפ של המשרה. מקור אמת אחד, שמשמש גם את הכרטיס וגם את ההמלצה הראשית,
 * כדי שלא יתפצלו שתי גרסאות של אותו מסך.
 *
 * R-32: נסגר ב-Escape, הפוקוס נכנס פנימה בפתיחה וחוזר לטריגר בסגירה.
 */
export function JobDetail({
  job, resumeCount = 0, onClose, arrivalLabel, fresh,
}: {
  job: Job;
  resumeCount?: number;
  onClose: () => void;
  arrivalLabel: string;
  fresh: boolean;
}) {
  const { applied, set, busy } = useJobStatus(job);
  const panel = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab' || !panel.current) return;
      const f = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtn.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);


  return (
    <div
      className="overlay fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-night/55 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={job.title}
    >
      <div
        ref={panel}
        className="sheet my-auto w-full max-w-2xl rounded-3xl border border-line bg-surface shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 border-b border-line p-6">
          <Logo job={job} large />
          <div className="min-w-0 flex-1">
            {fresh && (
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-flame-soft px-2.5 py-1 text-xs font-bold text-flame">
                עלתה בשלוש השעות האחרונות
              </span>
            )}
            <h2 className="font-display text-xl font-bold leading-snug text-ink sm:text-2xl">{job.title}</h2>
            {job.company && <p className="mt-1 font-semibold text-accent-ink">{job.company}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[job.location, job.scope, job.experience].filter(Boolean).map((m) => (
                <span key={m as string} className="rounded-lg bg-paper px-2 py-0.5 text-xs text-body">{m}</span>
              ))}
            </div>
            <SourceLine job={job} className="mt-2" />
            <p className="mt-1 text-xs text-muted">נקלטה {arrivalLabel}</p>
          </div>
          <button
            ref={closeBtn}
            onClick={onClose}
            aria-label="סגירת החלון"
            className="rounded-full p-2 text-muted transition hover:bg-paper hover:text-ink"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="border-b border-line bg-paper/50 px-6 py-4">
          <MatchMeter score={job.score} size="lg" />
          {job.ats_score !== null && (
            <p className="mt-1.5 text-xs text-muted">
              ציון ATS {job.ats_score} · ציון מגייס {job.hr_score}
              {job.rating ? ` · ${job.rating}` : ''}
            </p>
          )}
        </div>

        <div className="space-y-6 p-6">
          {!!tidy(job.summary) && <p className="leading-relaxed text-body">{tidy(job.summary)}</p>}

          {!!tidy(job.description) && (
            <section className="rounded-2xl bg-paper/60 p-5">
              <h3 className="mb-2 font-display text-lg font-bold text-ink">תיאור המשרה</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-body">{tidy(job.description)}</p>
            </section>
          )}
          {!!tidy(job.requirements) && (
            <section className="rounded-2xl bg-paper/60 p-5">
              <h3 className="mb-2 font-display text-lg font-bold text-ink">דרישות התפקיד</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-body">{tidy(job.requirements)}</p>
            </section>
          )}

          {/* עמודה שנשארת ריקה יוצרת חור בפריסה, אז הגריד נפתח רק כששני הצדדים מלאים */}
          {(!!job.responsibilities?.length || !!job.key_requirements?.length) && (
            <div className={`grid gap-6 ${job.responsibilities?.length && job.key_requirements?.length ? 'sm:grid-cols-2' : ''}`}>
              <Bullets title="תחומי אחריות" items={job.responsibilities} />
              <Bullets title="דרישות מרכזיות" items={job.key_requirements} />
            </div>
          )}

          {job.score_reasons && (
            <div className="grid gap-4 sm:grid-cols-2">
              {!!job.score_reasons.strengths?.length && (
                <div className="rounded-2xl bg-good-soft p-4">
                  <h4 className="mb-1.5 text-sm font-bold text-good">למה זה מתאים לזיו</h4>
                  <ul className="space-y-1 text-sm text-body">
                    {job.score_reasons.strengths.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
              {!!job.score_reasons.gaps?.length && (
                <div className="rounded-2xl bg-amber-soft p-4">
                  <h4 className="mb-1.5 text-sm font-bold text-amber">פערים</h4>
                  <ul className="space-y-1 text-sm text-body">
                    {job.score_reasons.gaps.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {job.buzzwords?.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-bold text-ink">מונחים שכדאי שיופיעו בקורות החיים</h4>
              <div className="flex flex-wrap gap-1.5">
                {job.buzzwords.map((b) => (
                  <span key={b} className="rounded-full border border-accent/20 bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-ink">{b}</span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <a
              href={job.url}
              target="_blank"
              rel="noopener"
              className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white transition hover:bg-accent-ink"
            >
              לעמוד המשרה ולהגשה
            </a>
            <AgentBrief jobId={job.id} jobTitle={job.title} />
            <TailorPanel jobId={job.id} />
            {resumeCount > 1 && <CompareVersions jobId={job.id} />}
            <button
              onClick={() => set(applied ? 'new' : 'applied')}
              disabled={busy}
              aria-pressed={applied}
              className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition disabled:opacity-50 ${
                applied ? 'border-good bg-good-soft text-good' : 'border-line text-body hover:border-ink hover:text-ink'
              }`}
            >
              {applied ? 'סומן כהוגשה' : 'סמן כהוגשה'}
            </button>
          </div>

          {/* אחרי הגשה המסך משנה תפקיד: מכאן והלאה השאלה היא הראיון והמעקב,
              ולא האם להגיש. לכן אלה מופיעים רק עכשיו ולא קודם. */}
          {applied && (
            <div className="space-y-4 border-t border-line pt-5">
              <FollowUp job={job} />
              <InterviewPrep jobId={job.id} jobTitle={job.title} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


/**
 * הטקסט שמגיע מדרושים מכיל רצפים של שורות ריקות, ו-whitespace-pre-wrap
 * הופך אותם לשטח ריק גבוה בתוך הפופאפ. מכווצים לפני ההצגה.
 */
function tidy(text: string | null): string {
  if (!text) return '';
  return text
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <h4 className="mb-1.5 text-sm font-bold text-ink">{title}</h4>
      <ul className="space-y-1.5 text-sm leading-relaxed text-body">
        {items.map((x, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent/60" aria-hidden="true" />
            <span>{x}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
