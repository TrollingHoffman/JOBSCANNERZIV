import { NextResponse } from 'next/server';
import { db, primaryResume } from '@/lib/supabase';
import { collectJobRefs, fetchJobDetail, sleep, type JobRef } from '@/lib/drushim';
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

    const refs = new Map<string, JobRef>();
    for (const s of searches) (await collectJobRefs(s.url, s.max_pages ?? 3)).forEach((r) => refs.set(r.externalId, r));
    stats.found = refs.size;

    const ids = [...refs.keys()];
    const { data: existing } = await db.from('jobs').select('id, external_id, last_seen_at, repost_dates').in('external_id', ids.length ? ids : ['__none__']);
    const known = new Map((existing ?? []).map((j: any) => [j.external_id, j]));
    const newRefs = [...refs.values()].filter((r) => !known.has(r.externalId));

    const now = Date.now();
    for (const [extId, prev] of known) {
      const gapDays = (now - new Date(prev.last_seen_at).getTime()) / 86400000;
      const patch: Record<string, any> = { last_seen_at: new Date().toISOString() };
      if (gapDays >= 4) {
        const dates: string[] = prev.repost_dates ?? [];
        if (!dates.includes(today)) { patch.repost_dates = [...dates, today]; stats.reposts++; }
      }
      await db.from('jobs').update(patch).eq('external_id', extId);
    }

    const analyzed: any[] = [];
    for (const ref of newRefs) {
      let detail;
      try { detail = await fetchJobDetail(ref); } catch { continue; }
      await sleep(400 + Math.random() * 300);

      const row: Record<string, any> = {
        external_id: detail.externalId, url: detail.url, title: detail.title,
        company: detail.company, location: detail.location, scope: detail.scope,
        experience: detail.experience, description: detail.description, requirements: detail.requirements,
        logo_url: detail.logoUrl, posted_at: detail.postedAt ?? today,
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
