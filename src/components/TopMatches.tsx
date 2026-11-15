import type { Job } from '@/lib/supabase';

export function TopMatches({ jobs }: { jobs: Job[] }) {
  if (jobs.length < 2) return null;
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-2xl font-bold text-ink">ההתאמות הכי חזקות</h2>
        <span className="text-xs text-muted">גררו לצדדים</span>
      </div>
      <div className="rail">
        {jobs.map((j) => (
          <a key={j.id} href={j.url} target="_blank" rel="noopener" className="card-hover w-[240px] rounded-3xl border border-line bg-surface p-5 shadow-card hover:border-accent/50 hover:shadow-lift">
            <div className="flex items-start justify-between gap-3">
              {j.logo_url ? <img src={j.logo_url} alt="" loading="lazy" className="h-10 w-10 rounded-xl border border-line bg-white object-contain p-1" /> : <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft font-display font-bold text-accent">{(j.company ?? j.title).trim().charAt(0)}</div>}
              <span className="font-display text-3xl font-bold leading-none text-accent">{j.score ?? 0}</span>
            </div>
            <p className="clamp-2 mt-4 font-bold leading-snug text-ink">{j.title}</p>
            {j.company && <p className="mt-1 text-sm text-muted">{j.company}</p>}
          </a>
        ))}
      </div>
    </section>
  );
}
