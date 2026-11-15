import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.action === 'add-search') {
      if (!body.url?.includes('drushim.co.il')) return NextResponse.json({ error: 'צריך קישור מאתר דרושים' }, { status: 400 });
      const { error } = await db.from('searches').insert({ label: body.label || 'חיפוש', url: body.url, max_pages: Math.max(1, Math.min(10, Number(body.maxPages) || 5)) });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, message: 'החיפוש נוסף' });
    }
    if (body.action === 'remove-search') {
      const { error } = await db.from('searches').delete().eq('id', body.id);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, message: 'החיפוש הוסר' });
    }
    if (body.action === 'toggle-search') {
      const { error } = await db.from('searches').update({ active: Boolean(body.active) }).eq('id', body.id);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, message: body.active ? 'החיפוש הופעל' : 'החיפוש הושהה' });
    }

    const emails: string[] = (body.emails ?? []).map((e: string) => String(e).trim()).filter((e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
    const { error } = await db.from('settings').update({
      notify_emails: emails,
      min_score: Math.max(0, Math.min(100, Number(body.minScore) || 55)),
      send_email: Boolean(body.sendEmail),
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, message: `נשמר · ${emails.length} נמענים` });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
