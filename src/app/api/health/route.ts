import { NextResponse } from 'next/server';
import { listModels, askJson } from '@/lib/gemini';
import { db, primaryResume } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const out: Record<string, any> = {
    env: {
      GEMINI_API_KEY_present: Boolean(process.env.GEMINI_API_KEY),
      GEMINI_MODEL: process.env.GEMINI_MODEL ?? '(בחירה אוטומטית)',
      SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? '(not set)',
      RESEND_present: Boolean(process.env.RESEND_API_KEY),
      CRON_SECRET_present: Boolean(process.env.CRON_SECRET),
    },
  };
  out.models = await listModels();
  try { out.generate = { ok: true, sample: await askJson<any>('החזר JSON בלבד: {"ok":"yes"}') }; }
  catch (e: any) { out.generate = { ok: false, error: String(e?.message ?? e) }; }
  try {
    const [a, b, c] = await Promise.all([
      db.from('jobs').select('*', { count: 'exact', head: true }),
      db.from('jobs').select('*', { count: 'exact', head: true }).is('score', null),
      db.from('jobs').select('*', { count: 'exact', head: true }).gte('score', 65),
    ]);
    const resume = await primaryResume();
    out.data = { jobs: a.count, unscored: b.count, strong65: c.count, resume: resume?.label ?? null };
  } catch (e: any) { out.data = { error: String(e?.message ?? e) }; }
  return NextResponse.json(out);
}
