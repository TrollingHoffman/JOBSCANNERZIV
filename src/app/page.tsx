import Link from 'next/link';
import { db, jobCount, type Job } from '@/lib/supabase';
import { JobCard } from '@/components/JobCard';
import { ScanButton } from '@/components/ScanButton';
import { AddJobPanel } from '@/components/AddJobPanel';
import { NextUp } from '@/components/NextUp';
import { Reveal } from '@/components/Motion';
import { THRESHOLD } from '@/components/MatchMeter';

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
  if (view === 'strong') q = q.gte('score', THRESHOLD);
  q = sort === 'new'
    ? q.order('first_seen_at', { ascending: false })
    : q.order('score', { ascending: false, nullsFirst: false });

  const { data } = await q.limit(300);
  const jobs = (data ?? []) as Job[];

  const [total, strong, savedCount, appliedCount, pending, freshCount, resumeCount, scanCount] = await Promise.all([
    jobCount(),
    jobCount((x) => x.gte('score', THRESHOLD)),
    jobCount((x) => x.eq('status', 'saved')),
    jobCount((x) => x.eq('status', 'applied')),
    jobCount((x) => x.is('score', null)),
    jobCount((x) => x.gte('first_seen_at', threeHoursAgo)),
    db.from('resumes').select('*', { count: 'exact', head: true }).then((r) => r.count ?? 0),
    db.from('scan_runs').select('*', { count: 'exact', head: true }).then((r) => r.count ?? 0),
  ]);

  const { data: lastRun } = await db
    .from('scan_runs').select('finished_at')
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false }).limit(1).maybeSingle();

  // ההחלטה שהמסך משרת: לאיזו משרה להגיש עכשיו.
  // המשרה הטובה ביותר שטרם טופלה, ורק בתצוגה הראשית.
  const { data: nextRows } = await db
    .from('jobs').select('*')
    .eq('status', 'new').not('score', 'is', null)
    .order('score', { ascending: false }).limit(1);
  const nextJob = view === 'all' && sort === 'score' ? ((nextRows?.[0] as Job) ?? null) : null;

  const listJobs = nextJob ? jobs.filter((j) => j.id !== nextJob.id) : jobs;

  return (
    <>
      <header className="border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <p className="font-display text-lg font-bold leading-none text-ink">
              משרות שיווק <span className="text-accent-ink">לזיו</span>
            </p>
            <p className="mt-1 text-xs text-muted">
              {lastRun?.finished_at
                ? `נסרק לאחרונה ${new Date(lastRun.finished_at).toLocaleString('he-IL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`
                : 'עוד לא בוצעה סריקה'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AddJobPanel />
            <ScanButton pending={pending} />
            <Link href="/reports" className="rounded-xl border border-line px-3.5 py-2 text-sm font-bold text-body transition hover:border-ink hover:text-ink">דוחות</Link>
            <Link href="/settings" className="rounded-xl border border-line px-3.5 py-2 text-sm font-bold text-body transition hover:border-ink hover:text-ink">הגדרות</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
        {resumeCount === 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber/30 bg-amber-soft p-4 text-sm">
            <span className="font-semibold text-amber">עדיין לא הועלו קורות חיים, ולכן אין ציוני התאמה.</span>
            <Link href="/settings" className="font-bold text-amber underline">להעלאת קורות חיים</Link>
          </div>
        )}

        {nextJob && <NextUp job={nextJob} resumeCount={resumeCount} />}

        <nav
          className="sticky top-0 z-30 -mx-4 mt-10 flex flex-wrap items-center gap-2 border-b border-line bg-paper/90 px-4 py-3 text-sm backdrop-blur sm:-mx-6 sm:px-6"
          aria-label="סינון משרות"
        >
          <Tab href="/" active={view === 'all' && sort === 'score'}>לפי התאמה</Tab>
          <Tab href="/?sort=new" active={view === 'all' && sort === 'new'}>החדשות ביותר</Tab>
          <Tab href="/?view=strong" active={view === 'strong'}>עוברות את הסף ({strong})</Tab>
          {freshCount > 0 && (
            <Tab href="/?view=fresh&sort=new" active={view === 'fresh'}>נקלטו בשלוש שעות ({freshCount})</Tab>
          )}
          <Tab href="/?view=saved" active={view === 'saved'}>משרות שאהבתי ({savedCount})</Tab>
          <Tab href="/?view=applied" active={view === 'applied'}>הוגשו ({appliedCount})</Tab>
        </nav>

        {listJobs.length === 0 ? (
          <EmptyState view={view} total={total} pending={pending} resumeCount={resumeCount} hasNext={!!nextJob} />
        ) : (
          <>
            <p className="mt-5 text-sm text-muted">
              {nextJob ? `עוד ${listJobs.length} משרות בתצוגה הזו` : `${listJobs.length} משרות בתצוגה הזו`}
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listJobs.map((j, i) => (
                <Reveal key={j.id} delay={Math.min(i, 5) * 45} className="h-full">
                  <JobCard job={j} resumeCount={resumeCount} />
                </Reveal>
              ))}
            </div>
          </>
        )}
      </main>

      {/* המספרים המצטברים הם כותרת תחתונה. הם מוכיחים שהמערכת עובדת,
          והם לא מקדמים את ההחלטה, ולכן הם לא בראש הדף (C-3). */}
      <footer className="mt-4 border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-x-10 gap-y-4 px-4 py-7 text-sm sm:px-6">
          <Figure value={total} label="משרות במאגר" href="/" />
          <Figure value={strong} label={`עוברות את הסף (${THRESHOLD}+)`} href="/?view=strong" />
          <Figure value={savedCount} label="משרות שאהבתי" href="/?view=saved" />
          <Figure value={appliedCount} label="הוגשו" href="/?view=applied" />
          <Figure value={scanCount} label="סריקות שבוצעו" href="/reports" />
          <Figure value={resumeCount} label="גרסאות קורות חיים" href="/settings" />
        </div>
      </footer>
    </>
  );
}

function Figure({ value, label, href }: { value: number; label: string; href: string }) {
  return (
    <Link href={href} className="group">
      <p className="font-display text-2xl font-bold leading-none text-ink transition group-hover:text-accent-ink">{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </Link>
  );
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={
        active
          ? 'rounded-full bg-ink px-4 py-2 font-bold text-white'
          : 'rounded-full border border-line bg-surface px-4 py-2 text-body transition hover:border-ink hover:text-ink'
      }
    >
      {children}
    </Link>
  );
}

/**
 * R-27: מצב ריק אומר למה הוא ריק ומה הפעולה שממלאת אותו.
 * ריצה ראשונה, סינון שלא החזיר כלום, ומאגר שכולו טופל הם מסכים שונים.
 */
function EmptyState({
  view, total, pending, resumeCount, hasNext,
}: { view: View; total: number; pending: number; resumeCount: number; hasNext: boolean }) {
  let title = 'אין משרות בתצוגה הזו';
  let why = '';
  let action: { label: string; href: string } | null = null;

  if (total === 0) {
    title = 'המאגר עוד ריק';
    why = 'עדיין לא רצה סריקה שהחזירה משרות. אפשר להריץ סריקה עכשיו, או להוסיף משרה מלינקדאין ידנית.';
    action = { label: 'לבדוק את קישורי החיפוש', href: '/settings' };
  } else if (view === 'saved') {
    title = 'עוד לא שמרת משרות';
    why = 'הלב שעל כל כרטיס מוסיף אותו לכאן, כדי שתהיה רשימה קצרה להגיש אליה.';
    action = { label: 'לעבור על המשרות', href: '/' };
  } else if (view === 'applied') {
    title = 'עוד לא סומנה הגשה';
    why = 'אחרי הגשה כדאי לסמן את המשרה, כדי שהרשימה תשקף מה כבר נעשה ומה לא.';
    action = { label: 'לעבור על המשרות', href: '/' };
  } else if (view === 'strong') {
    title = `אין משרות שעוברות את הסף (${THRESHOLD})`;
    why = pending > 0
      ? `${pending} משרות עדיין לא נותחו, ולכן אין להן ציון. ניתוח שלהן עשוי להעלות משרות לכאן.`
      : resumeCount === 0
        ? 'בלי קורות חיים אין ציוני התאמה, ולכן התצוגה הזו ריקה.'
        : 'המשרות שבמאגר קיבלו ציון מתחת לסף. אפשר לעבור על כולן לפי התאמה.';
    action = resumeCount === 0 ? { label: 'להעלות קורות חיים', href: '/settings' } : { label: 'לכל המשרות', href: '/' };
  } else if (view === 'fresh') {
    title = 'לא נקלטו משרות בשלוש השעות האחרונות';
    why = 'הסריקה רצה כל שעה בין 08:00 ל-22:00. זה אומר שלא עלו משרות חדשות, ולא שמשהו נכשל.';
    action = { label: 'לכל המשרות', href: '/' };
  } else if (hasNext) {
    title = 'זו המשרה היחידה שנותרה לטפל בה';
    why = 'כל השאר נשמרו, הוגשו, או לא עברו את הסף.';
  }

  return (
    <div className="mt-6 rounded-3xl border border-dashed border-line bg-surface p-10 text-center">
      <p className="font-display text-xl font-bold text-ink">{title}</p>
      {why && <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-body">{why}</p>}
      {action && (
        <Link href={action.href} className="mt-5 inline-block rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-white transition hover:bg-accent">
          {action.label}
        </Link>
      )}
    </div>
  );
}
