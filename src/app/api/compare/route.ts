import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { analyzeJob } from '@/lib/scoring';

export const maxDuration = 180;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { jobId, force } = await req.json();
    if (!jobId) return NextResponse.json({ error: 'חסר מזהה משרה' }, { status: 400 });

    if (!force) {
      const { data: cached } = await db.from('comparisons').select('*').eq('job_id', jobId).maybeSingle();
      if (cached) return NextResponse.json(cached);
    }

    const { data: job } = await db.from('jobs').select('*').eq('id', jobId).single();
    if (!job) return NextResponse.json({ error: 'המשרה לא נמצאה' }, { status: 404 });

    const { data: resumes } = await db.from('resumes').select('*').order('created_at');
    if (!resumes || resumes.length < 2) return NextResponse.json({ error: 'צריך לפחות שתי גרסאות' }, { status: 400 });

    const results: any[] = [];
    let firstError = '';
    for (const r of resumes) {
      try {
        const a = await analyzeJob(job, r.content);
        results.push({ resume_id: r.id, label: r.label, score: a.score, ats_score: a.ats_score, hr_score: a.hr_score, rating: a.rating, strengths: a.score_reasons?.strengths ?? [], gaps: a.score_reasons?.gaps ?? [] });
      } catch (e: any) { if (!firstError) firstError = String(e?.message ?? e); }
    }
    if (!results.length) return NextResponse.json({ error: firstError || 'הניקוד נכשל' }, { status: 500 });

    results.sort((a, b) => b.score - a.score);
    const best = results[0];
    const gap = best.score - (results[results.length - 1]?.score ?? 0);
    const verdict = gap <= 3 ? `הגרסאות קרובות מאוד (פער ${gap}).` : `עדיף לשלוח את "${best.label}" — פער ${gap} נקודות.`;

    await db.from('comparisons').upsert({ job_id: jobId, results, verdict }, { onConflict: 'job_id' });
    return NextResponse.json({ job_id: jobId, results, verdict });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
