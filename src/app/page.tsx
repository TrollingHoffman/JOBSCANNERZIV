import Link from 'next/link';
import { db, jobCount, type Job } from '@/lib/supabase';
import { JobCard } from '@/components/JobCard';
import { ScanButton } from '@/components/ScanButton';
import { TopMatches } from '@/components/TopMatches';
import { Reveal, CountUp, Marquee } from '@/components/Motion';

export const dynamic = 'force-dynamic';

type View = 'all' | 'saved' | 'applied' | 'fresh' | 'strong';

export default async function Home({ searchParams }: { searchParams: { view?: string; sort?: string } }) {
  const view = (searchParams.view ?? 'all') as View;
  const sort = searchParams.sort ?? 'score';
  const threeHoursAgo = new Date(Date.now() - 3 * 3600000).toISOString();

  let q: any = db.from('jobs').select('*');
  if (view === 'saved') q = q.eq('status', 'saved');
  if (view === 'applied') q = q.eq('status', 'applied');
  if (view === 'fresh') q = q.gte('first_seen_at', threeHoursAgo);
  if (view === 'strong') q = q.gte('score', 65);
  q = sort === 'new' ? q.order('first_seen_at', { ascending: false }) : q.order('score', { ascending: false, nullsFirst: false });

  const { data } = await q.limit(300);
  const jobs = (data ?? []) as Job[];

  // כל המונים נספרים בבסיס הנתונים, לא על מערך חלקי בזיכרון
  const [total, strong, savedCount, appliedCount, pending, freshCount, resumeCount] = await Promise.all([
    jobCount(),
    jobCount((x) => x.gte('score', 65)),
    jobCount((x) => x.eq('status', 'saved')),
    jobCount((x) => x.eq('status', 'applied')),
    jobCount((x) => x.is('score', null)),
    jobCount((x) => x.gte('first_seen_at', threeHoursAgo)),
    db.from('resumes').select('*', { count: 'exact', head: true }).then((r) => r.count ?? 0),
  ]);

  const { data: allBuzz } = await db.from('jobs').select('buzzwords');
  const freq = new Map<string, number>();
  (allBuzz ?? []).forEach((r: any) => (r.buzzwords ?? []).forEach((b: string) => freq.set(b, (freq.get(b) ?? 0) + 1)));
  const hot = [...freq.entries()].map(([term, count]) => ({ term, count })).sort((a, b) => b.count - a.count).slice(0, 20);

  const { data: lastRun } = await db.from('scan_runs').select('finished_at').not('finished_at', 'is', null).order('finished_at', { ascending: false }).limit(1).maybeSingle();

  const topMatches = view === 'all' ? jobs.filter((j) => (j.score ?? 0) >= 50).slice(0, 12) : [];

  return (
    <>
      <header className="bg-night px-4 pb-12 pt-10 text-white sm:px-6 sm:pb-14 sm:pt-14">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-bold tracking-wide text-signal">
              {lastRun?.finished_at
                ? `נסרק לאחרונה ${new Date(lastRun.finished_at).toLocaleString('he-IL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`
                : 'עוד לא בוצעה סריקה'}
            </p>
            <div className="flex items-center gap-2">
              <Link href="/reports" className="rounded-xl border border-white/20 px-4 py-2 text-sm font-bold transition hover:bg-white/10">דוח סריקות</Link>
              <Link href="/settings" className="rounded-xl border border-white/20 px-4 py-2 text-sm font-bold transition hover:bg-white/10">הגדרות</Link>
            </div>
          </div>

          <h1 className="mt-8 font-display text-[12vw] font-bold leading-[.94] sm:text-[4.8rem]">
            <span className="word"><span style={{ animationDelay: '80ms' }}>משרות שיווק</span></span>
            <span className="word"><span style={{ animationDelay: '220ms' }} className="text-signal">לזיו.</span></span>
          </h1>

          <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
            <div className="flex gap-8">
              <Stat value={total} label="משרות" href="/" />
              <Stat value={strong} label="התאמה 65+" href="/?view=strong" />
              <Stat value={savedCount} label="נשמרו" href="/?view=saved" />
            </div>
            <ScanButton pending={pending} />
          </div>

          {hot.length > 3 && (
            <div className="mt-10">
              <p className="mb-3 text-xs font-bold text-white/50">המונחים הכי מבוקשים במשרות שנסרקו</p>
              <Marquee items={hot} />
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        {resumeCount === 0 && (
          <div className="-mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber/25 bg-amber-soft p-4 text-sm shadow-card">
            <span className="font-semibold text-amber">עדיין לא הועלו קורות חיים, אז לא יחושבו ציוני התאמה.</span>
            <Link href="/settings" className="font-bold text-amber underline">להעלאה</Link>
          </div>
        )}

        {topMatches.length > 1 && <Reveal><TopMatches jobs={topMatches} /></Reveal>}

        <nav className="sticky top-0 z-30 -mx-4 mt-10 flex flex-wrap items-center gap-2 bg-paper/85 px-4 py-3 text-sm backdrop-blur sm:-mx-6 sm:px-6" aria-label="סינון">
          <Tab href="/" active={view === 'all' && sort === 'score'}>לפי התאמה</Tab>
          <Tab href="/?sort=new" active={view === 'all' && sort === 'new'}>החדשות ביותר</Tab>
          <Tab href="/?view=strong" active={view === 'strong'}>התאמה 65+ ({strong})</Tab>
          {freshCount > 0 && (
            <Link href="/?view=fresh&sort=new" className={view === 'fresh' ? 'rounded-full bg-flame px-4 py-2 font-bold text-white' : 'rounded-full border border-flame/40 bg-flame-soft px-4 py-2 font-bold text-flame transition hover:border-flame'}>
              טריות ({freshCount})
            </Link>
          )}
          <Tab href="/?view=saved" active={view === 'saved'}>משרות שאהבתי ({savedCount})</Tab>
          <Tab href="/?view=applied" active={view === 'applied'}>הוגשו ({appliedCount})</Tab>
        </nav>

        {jobs.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-line bg-surface/70 p-12 text-center">
            <p className="font-display text-xl font-bold text-ink">אין משרות בתצוגה הזו</p>
          </div>
        ) : (
          <>
            <p className="mt-4 text-sm text-muted">מוצגות {jobs.length} משרות</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {jobs.map((j, i) => (
                <Reveal key={j.id} delay={Math.min(i, 5) * 50} className="h-full">
                  <JobCard job={j} resumeCount={resumeCount} />
                </Reveal>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}

function Stat({ value, label, href }: { value: number; label: string; href: string }) {
  return (
    <Link href={href} className="transition hover:opacity-80">
      <p className="font-display text-4xl font-bold leading-none"><CountUp to={value} /></p>
      <p className="mt-1.5 text-xs text-white/50">{label}</p>
    </Link>
  );
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={active ? 'rounded-full bg-night px-4 py-2 font-bold text-white' : 'rounded-full border border-line bg-surface px-4 py-2 text-body transition hover:border-accent hover:text-accent'}>
      {children}
    </Link>
  );
}
