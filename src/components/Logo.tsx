import type { Job } from '@/lib/supabase';

/**
 * R-40: לוגו נטען עם מידות מוצהרות, כדי שהכרטיס לא יזוז כשהתמונה מגיעה.
 * כשאין לוגו, האות הראשונה של החברה היא placeholder כנה ולא תמונה מומצאת (R-23).
 */
export function Logo({ job, large }: { job: Job; large?: boolean }) {
  const px = large ? 56 : 44;
  const box = large ? 'h-14 w-14 text-2xl' : 'h-11 w-11 text-lg';

  if (job.logo_url) {
    return (
      <img
        src={job.logo_url}
        alt={job.company ? `הלוגו של ${job.company}` : ''}
        width={px}
        height={px}
        loading="lazy"
        className={`${box} logo-lift shrink-0 rounded-2xl border border-line bg-white object-contain p-1.5`}
      />
    );
  }

  return (
    <div
      className={`${box} logo-lift flex shrink-0 items-center justify-center rounded-2xl border border-line bg-paper font-display font-bold text-accent-ink`}
      aria-hidden="true"
    >
      {(job.company ?? job.title).trim().charAt(0)}
    </div>
  );
}
