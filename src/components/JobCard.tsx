'use client';

import { useState } from 'react';
import { MatchMeter } from './MatchMeter';
import { JobDetail } from './JobDetail';
import { Logo } from './Logo';
import { useJobStatus } from '@/lib/useJobStatus';
import type { Job } from '@/lib/supabase';

export function arrival(job: Job) {
  const seen = new Date(job.first_seen_at);
  const ageH = (Date.now() - seen.getTime()) / 3600000;
  const time = seen.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  const day = seen.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
  const isToday = new Date().toDateString() === seen.toDateString();
  return { label: isToday ? `היום בשעה ${time}` : `${day} בשעה ${time}`, fresh: ageH <= 3 };
}

export function JobCard({ job, resumeCount = 0 }: { job: Job; resumeCount?: number }) {
  const [open, setOpen] = useState(false);
  const { saved, applied, justSaved, busy, set } = useJobStatus(job);
  const a = arrival(job);

  return (
    <>
      {/* R-39: הכרטיס הוא כפתור אמיתי ולא div שאפשר ללחוץ עליו,
          כך שהוא נגיש במקלדת ומכריז על עצמו נכון. */}
      <article
        className={`card-hover relative flex h-full flex-col rounded-3xl border bg-surface p-5 shadow-card focus-within:shadow-lift hover:shadow-lift ${
          a.fresh ? 'border-flame/35 hover:border-flame' : 'border-line hover:border-ink/25'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <Logo job={job} />
          <button
            onClick={() => set(saved ? 'new' : 'saved')}
            disabled={busy}
            aria-pressed={saved}
            aria-label={saved ? `הסרת ${job.title} מהמשרות שאהבתי` : `שמירת ${job.title} למשרות שאהבתי`}
            className={`tap relative z-10 rounded-full transition disabled:opacity-50 ${
              saved ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-paper hover:text-accent'
            } ${justSaved ? 'pop' : ''}`}
          >
            <HeartIcon filled={saved} />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {a.fresh && (
            <span className="rounded-full bg-flame-soft px-2.5 py-1 text-xs font-bold text-flame">חדשה</span>
          )}
          {applied && (
            <span className="rounded-full bg-good-soft px-2.5 py-1 text-xs font-bold text-good">הוגשה</span>
          )}
          {job.repost_dates?.length > 0 && (
            <span className="rounded-full bg-amber-soft px-2.5 py-1 text-xs font-bold text-amber">
              פורסמה מחדש ({job.repost_dates.length})
            </span>
          )}
        </div>

        <h3 className="mt-2 font-display text-base font-bold leading-snug text-ink">
          <button onClick={() => setOpen(true)} className="card-link clamp-2 text-right transition hover:text-accent-ink">
            {job.title}
          </button>
        </h3>
        {job.company && <p className="mt-1 text-sm font-semibold text-accent-ink">{job.company}</p>}

        <div className="mt-2 flex flex-wrap gap-1.5">
          {[job.location, job.scope].filter(Boolean).map((m) => (
            <span key={m as string} className="rounded-lg bg-paper px-2 py-0.5 text-xs text-body">{m}</span>
          ))}
        </div>

        {(job.summary || job.description) && (
          <p className="clamp-3 mt-3 text-sm leading-relaxed text-body">{job.summary ?? job.description}</p>
        )}

        {/* הבאזוורדים נחשפים בריחוף או בפוקוס. מידע, לא קישוט, ולכן הם לא רצים בלופ. */}
        {job.buzzwords?.length > 0 && (
          <div className="peek relative z-10">
            <div className="flex flex-wrap gap-1">
              {job.buzzwords.slice(0, 6).map((b) => (
                <span key={b} className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-ink">{b}</span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto pt-4">
          <MatchMeter score={job.score} />
          <p className="mt-2 text-xs text-muted">נקלטה {a.label}</p>
        </div>
      </article>

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

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill={filled ? 'currentColor' : 'none'} aria-hidden="true">
      <path
        d="M10 16.5S3 12.4 3 7.9A3.9 3.9 0 0 1 10 5.6a3.9 3.9 0 0 1 7 2.3c0 4.5-7 8.6-7 8.6z"
        stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"
      />
    </svg>
  );
}
