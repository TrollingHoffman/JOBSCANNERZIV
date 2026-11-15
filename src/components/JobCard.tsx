'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScoreRing } from './ScoreRing';
import { TailorPanel } from './TailorPanel';
import { CompareVersions } from './CompareVersions';
import { useToast } from './Toast';
import type { Job } from '@/lib/supabase';

function arrival(job: Job) {
  const seen = new Date(job.first_seen_at);
  const ageH = (Date.now() - seen.getTime()) / 3600000;
  const time = seen.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  const day = seen.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
  const isToday = new Date().toDateString() === seen.toDateString();
  return { label: isToday ? `היום בשעה ${time}` : `${day} בשעה ${time}`, hot: ageH <= 3 };
}

export function JobCard({ job, resumeCount = 0 }: { job: Job; resumeCount?: number }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(job.status);
  const [justSaved, setJustSaved] = useState(false);
  const router = useRouter();
  const { notify } = useToast();

  const saved = status === 'saved';
  const applied = status === 'applied';
  const a = arrival(job);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open]);

  async function setJobStatus(next: 'new' | 'saved' | 'applied') {
    const prev = status;
    setStatus(next);
    if (next === 'saved') { setJustSaved(true); setTimeout(() => setJustSaved(false), 400); }
    const res = await fetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: job.id, status: next }) });
    if (!res.ok) {
      setStatus(prev);
      const j = await res.json().catch(() => ({}));
      notify('error', 'העדכון נכשל', j.error);
      return;
    }
    notify('success', next === 'saved' ? 'נשמר למועדפות' : next === 'applied' ? 'סומן כהוגשה' : 'הסימון בוטל', job.title);
    router.refresh();
  }

  return (
    <>
      <article onClick={() => setOpen(true)} className={`card-hover flex h-full cursor-pointer flex-col rounded-3xl border bg-surface p-5 shadow-card hover:shadow-lift ${a.hot ? 'border-flame/40 hover:border-flame' : 'border-line hover:border-accent/40'}`}>
        <div className="flex items-start justify-between gap-3">
          <Logo job={job} />
          <div className="flex items-center gap-1.5">
            <button onClick={(e) => { e.stopPropagation(); setJobStatus(saved ? 'new' : 'saved'); }} aria-pressed={saved} aria-label={saved ? 'הסרה מהמועדפות' : 'שמירה למועדפות'} className={`rounded-full p-2 transition ${saved ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-paper hover:text-accent'} ${justSaved ? 'pop' : ''}`}>
              <HeartIcon filled={saved} />
            </button>
            <ScoreRing score={job.score} />
          </div>
        </div>

        {a.hot && <span className="ember mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-flame-soft px-2.5 py-1 text-xs font-bold text-flame"><FireIcon />חדש</span>}

        <h3 className="clamp-2 mt-2 font-display text-base font-bold leading-snug text-ink">{job.title}</h3>
        {job.company && <p className="mt-1 text-sm font-semibold text-accent">{job.company}</p>}

        <div className="mt-2 flex flex-wrap gap-1.5">
          {[job.location, job.scope].filter(Boolean).map((m) => <span key={m as string} className="rounded-lg bg-paper px-2 py-0.5 text-xs text-body">{m}</span>)}
        </div>

        {(job.summary || job.description) && <p className="clamp-3 mt-3 text-sm leading-relaxed text-body">{job.summary ?? job.description}</p>}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4 text-xs text-muted">
          <span>נקלטה {a.label}</span>
          {job.rating && <span className="font-bold text-accent">{job.rating}</span>}
          {applied && <span className="rounded-full bg-accent-soft px-2 py-0.5 font-bold text-accent">הוגשה</span>}
          {job.repost_dates?.length > 0 && <span className="rounded-full bg-amber-soft px-2 py-0.5 font-bold text-amber">פורסמה מחדש</span>}
        </div>
      </article>

      {open && (
        <div className="overlay fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-night/55 p-4 backdrop-blur-sm sm:p-8" onClick={() => setOpen(false)} role="dialog" aria-modal="true">
          <div className="sheet my-auto w-full max-w-2xl rounded-3xl border border-line bg-surface shadow-modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-4 border-b border-line p-6">
              <Logo job={job} large />
              <div className="min-w-0 flex-1">
                {a.hot && <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-flame-soft px-2.5 py-1 text-xs font-bold text-flame"><FireIcon />עלתה בשלוש השעות האחרונות</span>}
                <h2 className="font-display text-xl font-bold leading-snug text-ink sm:text-2xl">{job.title}</h2>
                {job.company && <p className="mt-1 font-semibold text-accent">{job.company}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[job.location, job.scope, job.experience].filter(Boolean).map((m) => <span key={m as string} className="rounded-lg bg-paper px-2 py-0.5 text-xs text-body">{m}</span>)}
                </div>
                <p className="mt-2 text-xs text-muted">נקלטה {a.label}</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <button onClick={() => setOpen(false)} aria-label="סגירה" className="rounded-full p-2 text-muted transition hover:bg-paper hover:text-ink"><CloseIcon /></button>
                <ScoreRing score={job.score} size={68} />
                {job.ats_score !== null && <p className="text-[11px] text-muted">ATS {job.ats_score} · HR {job.hr_score}</p>}
              </div>
            </div>

            <div className="space-y-6 p-6">
              {job.summary && <p className="leading-relaxed text-body">{job.summary}</p>}
              {job.description && (
                <section className="rounded-2xl bg-paper/60 p-5">
                  <h3 className="mb-2 font-display text-lg font-bold text-accent">תיאור משרה</h3>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-body">{job.description}</p>
                </section>
              )}
              {job.requirements && (
                <section className="rounded-2xl bg-paper/60 p-5">
                  <h3 className="mb-2 font-display text-lg font-bold text-accent">דרישות התפקיד</h3>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-body">{job.requirements}</p>
                </section>
              )}

              <div className="grid gap-6 sm:grid-cols-2">
                <Bullets title="תחומי אחריות" items={job.responsibilities} />
                <Bullets title="דרישות מרכזיות" items={job.key_requirements} />
              </div>

              {job.score_reasons && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {!!job.score_reasons.strengths?.length && (
                    <div className="rounded-2xl bg-accent-soft p-4">
                      <h4 className="mb-1.5 text-sm font-bold text-accent">למה זה מתאים</h4>
                      <ul className="space-y-1 text-sm text-body">{job.score_reasons.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    </div>
                  )}
                  {!!job.score_reasons.gaps?.length && (
                    <div className="rounded-2xl bg-amber-soft p-4">
                      <h4 className="mb-1.5 text-sm font-bold text-amber">פערים</h4>
                      <ul className="space-y-1 text-sm text-body">{job.score_reasons.gaps.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    </div>
                  )}
                </div>
              )}

              {job.buzzwords?.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-bold text-ink">מונחים שכדאי שיופיעו בקורות החיים</h4>
                  <div className="flex flex-wrap gap-1.5">{job.buzzwords.map((b) => <span key={b} className="rounded-full border border-accent/15 bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">{b}</span>)}</div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
                <TailorPanel jobId={job.id} />
                {resumeCount > 1 && <CompareVersions jobId={job.id} />}
                <button onClick={() => setJobStatus(applied ? 'new' : 'applied')} className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition ${applied ? 'border-accent bg-accent-soft text-accent' : 'border-line text-body hover:border-accent hover:text-accent'}`}>
                  {applied ? 'הוגשה ✓' : 'סמן כהוגשה'}
                </button>
                <a href={job.url} target="_blank" rel="noopener" className="text-sm font-bold text-accent underline">המשרה בדרושים</a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Logo({ job, large }: { job: Job; large?: boolean }) {
  const size = large ? 'h-14 w-14 text-2xl' : 'h-11 w-11 text-lg';
  if (job.logo_url) return <img src={job.logo_url} alt={job.company ?? ''} loading="lazy" className={`${size} shrink-0 rounded-2xl border border-line bg-white object-contain p-1.5`} />;
  return <div className={`${size} flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-soft to-paper font-display font-bold text-accent`}>{(job.company ?? job.title).trim().charAt(0)}</div>;
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <h4 className="mb-1.5 text-sm font-bold text-ink">{title}</h4>
      <ul className="space-y-1.5 text-sm leading-relaxed text-body">
        {items.map((x, i) => <li key={i} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent/50" /><span>{x}</span></li>)}
      </ul>
    </div>
  );
}

function FireIcon() { return <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1s.6 2.1-.9 3.7C5.4 6.5 4 7.7 4 9.8A4 4 0 0 0 12 10c0-2.1-1.2-3.2-1.9-4.6-.3 .6-.8 1-1.3 1.2.4-1.9-.2-4-.8-5.6z" /></svg>; }
function HeartIcon({ filled }: { filled: boolean }) { return <svg width="18" height="18" viewBox="0 0 20 20" fill={filled ? 'currentColor' : 'none'} aria-hidden="true"><path d="M10 16.5S3 12.4 3 7.9A3.9 3.9 0 0 1 10 5.6a3.9 3.9 0 0 1 7 2.3c0 4.5-7 8.6-7 8.6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>; }
function CloseIcon() { return <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>; }
