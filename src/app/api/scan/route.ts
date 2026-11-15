import { NextResponse } from 'next/server';
import { db, primaryResume } from '@/lib/supabase';
import { sleep } from '@/lib/drushim';
import { collectRefs, detectBoard, boardLabel, type BoardId, type BoardJobRef } from '@/lib/boards';
import { fetchBoardDetail } from '@/lib/boardDetail';
import { analyzeJob } from '@/lib/scoring';
import { sendDigest } from '@/lib/email';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'לא מורשה' }, { status: 401 });
  return runScan();
}
export async function POST() { return runScan(); }

async function runScan() {
  // סריקה שנקטעה באמצע משאירה שורה פתוחה לנצח, ואז הדוח מציג אותה כרצה.
  // סוגרים כאן כל שורה שנפתחה לפני יותר מרבע שעה ולא הסתיימה.
  await db
    .from('scan_runs')
    .update({ finished_at: new Date().toISOString(), error: 'הסריקה נקטעה לפני שהסתיימה' })
    .is('finished_at', null)
    .lt('started_at', new Date(Date.now() - 15 * 60000).toISOString());

  const { data: run } = await db.from('scan_runs').insert({}).select().single();
  const runId = run?.id;
  const stats = { found: 0, new_jobs: 0, reposts: 0, emailed: 0 };
  const today = new Date().toISOString().slice(0, 10);
  let firstAnalysisError = '';

  try {
    const { data: settings } = await db.from('settings').select('*').eq('id', 1).single();
    const { data: searches } = await db.from('searches').select('*').eq('active', true);
    const resume = await primaryResume();
    if (!searches?.length) throw new Error('לא הוגדר אף חיפוש.');

    // כל חיפוש נסרק לפי הלוח שלו, והתוצאה נרשמת על החיפוש עצמו.
    // לוח שחוסם אותנו חייב להיות גלוי בהגדרות ולא להיכשל בשקט.
    const refs = new Map<string, { ref: BoardJobRef; board: BoardId }>();

    for (const s of searches) {
      const board: BoardId = (s.board as BoardId) || detectBoard(s.url);
      try {
        const found = await collectRefs(s.url, board, s.max_pages ?? 3);
        found.forEach((r) => {
          // דרושים שומר מזהה חשוף מההתחלה, ו-159 המשרות הקיימות שמורות כך.
          // הוספת קידומת להן הייתה גורמת לכולן להיראות חדשות ולהיכפל.
          // לוחות חדשים כן מקבלים קידומת, כדי ששני לוחות עם אותו מספר לא יתנגשו.
          const key = board === 'drushim' ? r.externalId : `${board}:${r.externalId}`;
          refs.set(key, { ref: r, board });
        });
        await db.from('searches').update({
          last_ok_at: new Date().toISOString(), last_error: null, last_found: found.length,
        }).eq('id', s.id);
      } catch (e: any) {
        const msg = `${boardLabel(board)}: ${String(e?.message ?? e)}`;
        await db.from('searches').update({ last_error: msg, last_found: 0 }).eq('id', s.id);
        if (!firstAnalysisError) firstAnalysisError = msg;
      }
    }
    stats.found = refs.size;

    // המזהה במסד נושא את הלוח, כדי ששתי משרות שונות עם אותו מספר
    // בשני לוחות לא ייחשבו לאותה משרה.
    const ids = [...refs.keys()];
    const { data: existing } = await db.from('jobs').select('id, external_id, last_seen_at, repost_dates').in('external_id', ids.length ? ids : ['__none__']);
    const known = new Map((existing ?? []).map((j: any) => [j.external_id, j]));
    const newRefs = [...refs.entries()].filter(([key]) => !known.has(key));

    // סימון "נראתה שוב" בקריאה אחת לכל המשרות המוכרות, במקום קריאה לכל משרה.
    // רק פרסום חוזר, שהוא נדיר, מטופל בנפרד.
    const now = Date.now();
    const seenAgain: string[] = [];
    const reposted: { id: string; dates: string[] }[] = [];

    for (const [extId, prev] of known) {
      const gapDays = (now - new Date(prev.last_seen_at).getTime()) / 86400000;
      const dates: string[] = prev.repost_dates ?? [];
      if (gapDays >= 4 && !dates.includes(today)) {
        reposted.push({ id: prev.id, dates: [...dates, today] });
        stats.reposts++;
      } else {
        seenAgain.push(extId);
      }
    }

    if (seenAgain.length) {
      await db.from('jobs').update({ last_seen_at: new Date().toISOString() }).in('external_id', seenAgain);
    }
    for (const r of reposted) {
      await db.from('jobs')
        .update({ last_seen_at: new Date().toISOString(), repost_dates: r.dates })
        .eq('id', r.id);
    }

    const analyzed: any[] = [];
    for (const [key, { ref, board }] of newRefs) {
      let detail;
      try { detail = await fetchBoardDetail(ref, board); } catch { continue; }
      await sleep(400 + Math.random() * 300);

      const row: Record<string, any> = {
        external_id: key, url: detail.url, title: detail.title,
        company: detail.company, location: detail.location, scope: detail.scope,
        experience: detail.experience, description: detail.description, requirements: detail.requirements,
        posted_at: detail.postedAt ?? today, source: board,
      };

      if (resume?.content) {
        try {
          const a = await analyzeJob(detail, resume.content);
          Object.assign(row, {
            score: a.score, ats_score: a.ats_score, hr_score: a.hr_score, rating: a.rating,
            summary: a.summary, responsibilities: a.responsibilities, key_requirements: a.key_requirements,
            buzzwords: a.buzzwords, score_reasons: a.score_reasons, analyzed_at: new Date().toISOString(),
          });
        } catch (e: any) { if (!firstAnalysisError) firstAnalysisError = String(e?.message ?? e); }
      }

      const { data: saved } = await db.from('jobs').insert(row).select().single();
      if (saved) { analyzed.push(saved); stats.new_jobs++; }
    }

    if (settings?.send_email && settings.notify_emails?.length) {
      const worth = analyzed.filter((j) => (j.score ?? 0) >= (settings.min_score ?? 55)).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      if (worth.length) {
        stats.emailed = await sendDigest(settings.notify_emails, worth);
        await db.from('jobs').update({ notified: true }).in('id', worth.map((j) => j.id));
      }
    }

    await db.from('scan_runs').update({ ...stats, error: firstAnalysisError || null, finished_at: new Date().toISOString() }).eq('id', runId);
    return NextResponse.json({ ok: true, ...stats, error: firstAnalysisError || undefined });
  } catch (e: any) {
    await db.from('scan_runs').update({ ...stats, error: String(e?.message ?? e), finished_at: new Date().toISOString() }).eq('id', runId);
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
