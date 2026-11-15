import { NextResponse } from 'next/server';
import { db, primaryResume } from '@/lib/supabase';
import { tailorResume } from '@/lib/scoring';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { jobId, force, resumeId } = await req.json();
    if (!jobId) return NextResponse.json({ error: 'חסר מזהה משרה' }, { status: 400 });

    if (!force) {
      const { data: cached } = await db.from('tailorings').select('*').eq('job_id', jobId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (cached) return NextResponse.json(cached);
    }

    const { data: job } = await db.from('jobs').select('*').eq('id', jobId).single();
    if (!job) return NextResponse.json({ error: 'המשרה לא נמצאה' }, { status: 404 });

    let resume: any = null;
    if (resumeId) { const { data } = await db.from('resumes').select('*').eq('id', resumeId).maybeSingle(); resume = data; }
    if (!resume) resume = await primaryResume();
    if (!resume?.content) return NextResponse.json({ error: 'לא הועלו קורות חיים.' }, { status: 400 });

    const result = await tailorResume(job as any, resume.content);
    const { data: saved } = await db.from('tailorings').insert({ job_id: jobId, resume_id: resume.id, ...result }).select().single();
    return NextResponse.json(saved);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
