import Link from 'next/link';
import { db, jobCount, type Job } from '@/lib/supabase';
import { JobCard } from '@/components/JobCard';
import { ScanButton } from '@/components/ScanButton';
import { AddJobPanel } from '@/components/AddJobPanel';
import { NextUp } from '@/components/NextUp';
import { Journey } from '@/components/Journey';
import { Reveal } from '@/components/Motion';
import { THRESHOLD, FRESH_HOURS, FOLLOW_UP_DAYS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

type View = 'all' | 'saved' | 'applied' | 'fresh' | 'strong';

function greeting(d = new Date()) {
  const h = Number(d.toLocaleString('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', hour12: false }));
  if (h < 11) return 'בוקר טוב, זיו';
  if (h < 16) return 'צהריים טובים, זיו';
  if (h < 20) return 'אחר צהריים טובים, זיו';
  return 'ערב טוב, זיו';
}

export default async function Home({ searchParams }: { searchParams: { view?: string; sort?: string } }) {
  const view = (searchParams.view ?? 'all') as View;
  const sort = searchParams.sort ?? 'score';
  const freshCutoff = new Date(Date.now() - FRESH_HOURS * 3600000).toISOString();

  // מוסתרות ומה שזיו פסלה לא מופיעות בשום תצוגה ולא נספרות
  const LIVE = ['new', 'saved', 'applied'];
  let q: any = db.from('jobs').select('*').in('status', LIVE);
  if (view === 'saved') q = q.eq('status', 'saved');
  if (view === 'applied') q = q.eq('status', 'applied');
  if (view === 'fresh') q = q.gte('first_seen_at', freshCutoff);
  if (view === 'strong') q = q.gte('score', THRESHOLD);
  q = sort === 'new'
    ? q.order('first_seen_at', { ascending: false })
    : q.order('score', { ascending: false, nullsFirst: false });

  const { data } = await q.limit(300);
  const jobs = (data ?? []) as Job[];

  const visible = (x: any) => x.in('status', LIVE);
  const [total, strong, savedCount, appliedCount, pending, freshCount, resumeCount] = await Promise.all([
    jobCount(visible),
    jobCount((x) => visible(x).gte('score', THRESHOLD)),
    jobCount((x) => x.eq('status', 'saved')),
    jobCount((x) => x.eq('status', 'applied')),
    jobCount((x) => visible(x).is('score', null)),
    jobCount((x) => visible(x).gte('first_seen_at', freshCutoff)),
    db.from('resumes').select('*', { count: 'exact', head: true }).then((r) => r.count ?? 0),
  ]);

  // מה שבאמת נשאר לעבור עליו: לא סך הכל, ולא מה שכבר טופל
  const untouchedStrong = await jobCount((x) => x.eq('status', 'new').gte('score', THRESHOLD));

  const nudgeCutoff = new Date(Date.now() - FOLLOW_UP_DAYS * 86400000).toISOString();
  const needFollowUp = await jobCount((x) =>
    x.eq('status', 'applied').is('followed_up_at', null).lte('applied_at', nudgeCutoff)
  );

  const { data: lastRun } = await db
    .from('scan_runs').select('finished_at')
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false }).limit(1).maybeSingle();

  const { data: nextRows } = await db
    .from('jobs').select('*')
    .eq('status', 'new').not('score', 'is', null)
    .order('score', { ascending: false }).limit(1);
  const nextJob = view === 'all' ? ((nextRows?.[0] as Job) ?? null) : null;

  const listJobs = nextJob ? jobs.filter((j) => j.id !== nextJob.id) : jobs;

  return (
    <>
      {/* הכניסה. רחבה, כהה וחמה, עם טיפוגרפיה גדולה.
          זה הרגע שבו זיו פותחת את האתר, והוא צריך להרגיש כמו משהו ולא כמו טבלה. */}
      <header className="bg-night text-white">
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-6 sm:px-6 sm:pb-10 sm:pt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="enter enter-fade text-xs text-white/50">
              {lastRun?.finished_at
                ? `נסרק לאחרונה ${new Date(lastRun.finished_at).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`
                : 'עוד לא בוצעה סריקה'}
            </p>
            <nav className="enter enter-fade flex flex-wrap items-center gap-2" style={{ ["--enter-delay" as string]: "60ms" }} aria-label="פעולות">
              {untouchedStrong > 0 && (
                <Link
                  href="/review"
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white transition hover:bg-accent-ink"
                >
                  לעבור על המשרות ({untouchedStrong})
                </Link>
              )}
              <AddJobPanel />
              <ScanButton pending={pending} />
              <Link href="/reports" className="rounded-xl border border-white/20 px-3.5 py-2 text-sm font-bold text-white/85 transition hover:border-white/50 hover:text-white">דוחות</Link>
              <Link href="/settings" className="rounded-xl border border-white/20 px-3.5 py-2 text-sm font-bold text-white/85 transition hover:border-white/50 hover:text-white">הגדרות</Link>
            </nav>
          </div>

          <h1 className="mt-7 font-display text-[2.6rem] font-bold leading-[1.02] sm:text-6xl">
            <span className="word"><span style={{ animationDelay: '60ms' }}>{greeting()}</span></span>
            <span className="word">
              <span style={{ animationDelay: '200ms' }} className="text-signal">
                {untouchedStrong > 0
                  ? `${untouchedStrong} ${untouchedStrong === 1 ? 'משרה מחכה' : 'משרות מחכות'} שתעברי עליהן.`
                  : freshCount > 0
                    ? `${freshCount} ${freshCount === 1 ? 'משרה חדשה נכנסה' : 'משרות חדשות נכנסו'} בשעות האחרונות.`
                    : 'עברת על הכל. יפה.'}
              </span>
            </span>
          </h1>

          <div className="enter mt-8" style={{ ["--enter-delay" as string]: "260ms", ["--enter-y" as string]: "10px" }}>
            <Journey scanned={total} passing={strong} loved={savedCount} applied={appliedCount} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
        {resumeCount === 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber/30 bg-amber-soft p-4 text-sm">
            <span className="font-semibold text-amber">עדיין לא הועלו קורות חיים, ולכן אין ציוני התאמה.</span>
            <Link href="/settings" className="font-bold text-amber underline">להעלאת קורות חיים</Link>
          </div>
        )}

        {nextJob && <NextUp job={nextJob} resumeCount={resumeCount} />}

        <nav
          className="sticky top-0 z-30 -mx-4 mt-10 flex flex-wrap items-center gap-2 border-b border-line bg-paper/95 px-4 py-3 text-sm backdrop-blur sm:-mx-6 sm:px-6"
          aria-label="סינון משרות"
        >
          <Tab href="/" active={view === 'all' && sort === 'score'}>לפי התאמה</Tab>
          <Tab href="/?sort=new" active={view === 'all' && sort === 'new'}>החדשות ביותר</Tab>
          <Tab href="/?view=strong" active={view === 'strong'}>עוברות את הסף ({strong})</Tab>
          {freshCount > 0 && (
            <Tab href="/?view=fresh&sort=new" active={view === 'fresh'}>נקלטו עכשיו ({freshCount})</Tab>
          )}
          <Tab href="/?view=saved" active={view === 'saved'}>משרות שאהבתי ({savedCount})</Tab>
          <Tab href="/?view=applied" active={view === 'applied'}>הוגשו ({appliedCount})</Tab>
        </nav>

        {view === 'applied' && needFollowUp > 0 && (
          <div className="mt-5 rounded-2xl border border-amber/35 bg-amber-soft p-4 text-sm">
            <span className="font-semibold text-amber">
              {needFollowUp === 1
                ? `משרה אחת הוגשה לפני ${FOLLOW_UP_DAYS} ימים או יותר ועדיין לא נשלחה אליה פנייה.`
                : `${needFollowUp} משרות הוגשו לפני ${FOLLOW_UP_DAYS} ימים או יותר ועדיין לא נשלחה אליהן פנייה.`}
            </span>
            <span className="mt-1 block text-xs text-body">פתיחת המשרה מציגה נוסח פנייה מוכן לשליחה.</span>
          </div>
        )}

        {listJobs.length === 0 ? (
          <EmptyState view={view} total={total} pending={pending} resumeCount={resumeCount} hasNext={!!nextJob} />
        ) : (
          <>
            <p className="mt-5 text-sm text-muted">
              {nextJob ? `עוד ${listJobs.length} משרות בתצוגה הזו` : `${listJobs.length} משרות בתצוגה הזו`}
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listJobs.map((j, i) => {
                // השהיות מתכווצות ומרחק שיורד: הקבוצה נקראת כגל ולא כתור.
                // מרווחים שווים הם המקבילה של linear באלמנט בודד.
                const step = [0, 70, 125, 165, 195, 215];
                const dist = [26, 22, 18, 16, 14, 14];
                const k = Math.min(i, step.length - 1);
                return (
                  <Reveal key={j.id} delay={step[k]} distance={dist[k]} className="h-full">
                    <JobCard job={j} resumeCount={resumeCount} />
                  </Reveal>
                );
              })}
            </div>
          </>
        )}
      </main>
    </>
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
      ? `${pending} משרות עדיין לא נותחו, ולכן אין להן ציון. הניתוח רץ אוטומטית כל עשר דקות.`
      : resumeCount === 0
        ? 'בלי קורות חיים אין ציוני התאמה, ולכן התצוגה הזו ריקה.'
        : 'המשרות שבמאגר קיבלו ציון מתחת לסף. אפשר לעבור על כולן לפי התאמה.';
    action = resumeCount === 0 ? { label: 'להעלות קורות חיים', href: '/settings' } : { label: 'לכל המשרות', href: '/' };
  } else if (view === 'fresh') {
    title = 'לא נקלטו משרות בשעות האחרונות';
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
