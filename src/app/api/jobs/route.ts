import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { jobId, status, followedUp } = await req.json();
    if (!jobId) return NextResponse.json({ error: 'חסר מזהה משרה' }, { status: 400 });

    // סימון מעקב אחרי הגשה. פעולה נפרדת, שלא נוגעת במצב המשרה.
    if (typeof followedUp === 'boolean') {
      const { error } = await db
        .from('jobs')
        .update({ followed_up_at: followedUp ? new Date().toISOString() : null })
        .eq('id', jobId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, followedUp });
    }

    if (!['new', 'saved', 'applied', 'hidden', 'dismissed'].includes(status)) {
      return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 });
    }

    const patch: Record<string, any> = {
      status,
      saved_at: status === 'saved' ? new Date().toISOString() : null,
    };
    // "לא בשבילי" הוא החלטה של זיו, ולכן נשמר מתי. זה שונה ממשרה
    // שהוסתרה בגלל ייבוא שגוי.
    if (status === 'dismissed') patch.dismissed_at = new Date().toISOString();
    // ביטול סימון ההגשה מנקה גם את המעקב, אחרת נשאר מעקב אחרי משרה שלא הוגשה
    if (status !== 'applied') patch.followed_up_at = null;

    const { error } = await db.from('jobs').update(patch).eq('id', jobId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, status });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
