import { sourceLabel } from '@/lib/sources';
import type { Job } from '@/lib/supabase';

/**
 * מאיפה המשרה הגיעה, ואצל מי.
 *
 * במשרת לינקדאין זה קריטי: שם פונים לאדם ולא לתיבת מייל כללית, ושם המגייס/ת
 * הוא ההבדל בין פנייה אישית לבין עוד הגשה שנבלעת.
 */
export function SourceLine({ job, className = '' }: { job: Job; className?: string }) {
  const isLinkedin = job.source === 'linkedin';
  const parts = [job.company, job.location].filter(Boolean) as string[];

  return (
    <p className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs ${className}`}>
      <span
        className={`rounded-md px-1.5 py-0.5 font-bold ${
          isLinkedin ? 'bg-[#0A66C2]/10 text-[#0A5090]' : 'bg-paper text-muted'
        }`}
      >
        {sourceLabel(job.source)}
      </span>
      {parts.length > 0 && <span className="text-muted">{parts.join(' · ')}</span>}
      {job.recruiter && (
        <span className="text-muted">
          · מגייס/ת: <span className="font-semibold text-body">{job.recruiter}</span>
        </span>
      )}
    </p>
  );
}
