import { NextResponse } from 'next/server';
import { db, primaryResume } from '@/lib/supabase';
import { analyzeJob } from '@/lib/scoring';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * מנתח משרות ללא ציון עד תקריב הזמן של הפונקציה,
 * ומחזיר כמה נשארו. הלקוח ממשיך לקרוא עד שהשארית אפס.
 */
/**
 * קריאה מתוזמנת. pg_cron קורא לזה אחרי כל סריקה, כך שמשרות חדשות
 * מקבלות ציון בלי שאף אחד ילחץ על כפתור.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'לא מורשה' }, { status: 401 });
  }
  return run({});
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return run(body);
}

async function run(body: any) {
  const startedAt = Date.now();
  const BUDGET_MS = 240000;

  try {
    const resume = await primaryResume();
    if (!resume?.content) {
      return NextResponse.json({ error: 'לא נמצאה גרסת קורות חיים ראשית. יש להעלות אחת בהגדרות.' }, { status: 400 });
    }

    // משרה מוסתרת לא תוצג לזיו, ולכן אין סיבה לשרוף עליה מכסת ניתוח
    let q: any = db.from('jobs').select('*').neq('status', 'hidden');
    if (!body.redoAll) q = q.is('score', null);
    const { data: jobs } = await q.limit(60);

    if (!jobs?.length) return NextResponse.json({ ok: true, analyzed: 0, failed: 0, remaining: 0, done: true });

    let done = 0, failed = 0, firstError = '';

    for (const job of jobs) {
      if (Date.now() - startedAt > BUDGET_MS) break;
      try {
        const a = await analyzeJob(job, resume.content);
        await db.from('jobs').update({
          score: a.score, ats_score: a.ats_score, hr_score: a.hr_score, rating: a.rating,
          summary: a.summary, responsibilities: a.responsibilities, key_requirements: a.key_requirements,
          buzzwords: a.buzzwords, score_reasons: a.score_reasons, analyzed_at: new Date().toISOString(),
        }).eq('id', job.id);
        done++;
      } catch (e: any) {
        failed++;
        if (!firstError) firstError = String(e?.message ?? e);
        if (failed >= 3 && done === 0) break;
      }
    }

    const { count: remaining } = await db.from('jobs').select('*', { count: 'exact', head: true }).is('score', null);

    if (done === 0 && failed > 0) {
      return NextResponse.json({ error: firstError, analyzed: 0, failed, remaining: remaining ?? 0 }, { status: 500 });
    }

    return NextResponse.json({
      ok: true, analyzed: done, failed, remaining: remaining ?? 0,
      done: (remaining ?? 0) === 0, error: firstError || undefined,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
