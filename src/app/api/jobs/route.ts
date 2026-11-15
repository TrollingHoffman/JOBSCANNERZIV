import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { jobId, status } = await req.json();
    if (!jobId || !['new', 'saved', 'applied', 'hidden'].includes(status)) return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 });
    const { error } = await db.from('jobs').update({ status, saved_at: status === 'saved' ? new Date().toISOString() : null }).eq('id', jobId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, status });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
