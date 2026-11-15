import Link from 'next/link';
import { db, type Job } from '@/lib/supabase';
import { ReviewDeck } from '@/components/ReviewDeck';
import { THRESHOLD } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/**
 * מסך המעבר על המשרות.
 *
 * הסדר הוא לפי ציון: זיו רואה קודם את מה שהכי מתאים לה, כך שגם אם היא
 * עוברת רק על עשר משרות, אלה העשר הנכונות.
 */
export default async function Review({ searchParams }: { searchParams: { all?: string } }) {
  const onlyStrong = searchParams.all !== '1';

  let q: any = db.from('jobs').select('*').eq('status', 'new');
  if (onlyStrong) q = q.gte('score', THRESHOLD);

  const { data } = await q.order('score', { ascending: false, nullsFirst: false }).limit(120);
  const jobs = (data ?? []) as Job[];

  const resumeCount = await db
    .from('resumes').select('*', { count: 'exact', head: true }).then((r) => r.count ?? 0);

  const { count: allNew } = await db
    .from('jobs').select('*', { count: 'exact', head: true })
    .eq('status', 'new').neq('status', 'hidden');

  return (
    <>
      <header className="border-b border-line bg-paper/95">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <h1 className="font-display text-lg font-bold leading-none text-ink">מעבר על המשרות</h1>
            <p className="mt-1 text-xs text-muted">
              {onlyStrong ? `רק מה שעובר את הסף (${THRESHOLD}+)` : 'כל המשרות שטרם טופלו'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={onlyStrong ? '/review?all=1' : '/review'}
              className="rounded-xl border border-line px-3.5 py-2 text-sm font-bold text-body transition hover:border-ink hover:text-ink"
            >
              {onlyStrong ? `לעבור על הכל (${allNew ?? 0})` : `רק מעל הסף`}
            </Link>
            <Link href="/" className="rounded-xl border border-line px-3.5 py-2 text-sm font-bold text-body transition hover:border-ink hover:text-ink">
              חזרה
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <ReviewDeck jobs={jobs} resumeCount={resumeCount} />
      </main>
    </>
  );
}
