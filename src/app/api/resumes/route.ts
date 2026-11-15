import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { fileToText } from '@/lib/extract';
import { gradeResume } from '@/lib/scoring';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const type = req.headers.get('content-type') ?? '';

    if (type.includes('application/json')) {
      const body = await req.json();

      if (body.action === 'primary') {
        const { error: e1 } = await db.from('resumes').update({ is_primary: false }).neq('id', body.id);
        if (e1) throw new Error(e1.message);
        const { error: e2 } = await db.from('resumes').update({ is_primary: true }).eq('id', body.id);
        if (e2) throw new Error(e2.message);
        return NextResponse.json({ ok: true, message: 'הגרסה הוגדרה כראשית' });
      }

      /** ריקון הסלוט הראשי — נשארים בלי גרסה ראשית */
      if (body.action === 'clear-primary') {
        const { error } = await db.from('resumes').update({ is_primary: false }).eq('is_primary', true);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true, message: 'הסלוט הראשי רוקן', warn: 'בלי גרסה ראשית לא יחושבו ציוני התאמה' });
      }

      if (body.action === 'rename') {
        const { error } = await db.from('resumes').update({ label: String(body.label).slice(0, 60) }).eq('id', body.id);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true, message: 'השם עודכן' });
      }

      if (body.action === 'delete') {
        const { data: target } = await db.from('resumes').select('is_primary, label').eq('id', body.id).single();
        const { error } = await db.from('resumes').delete().eq('id', body.id);
        if (error) throw new Error(error.message);
        if (target?.is_primary) {
          const { data: next } = await db.from('resumes').select('id').order('created_at').limit(1).maybeSingle();
          if (next) await db.from('resumes').update({ is_primary: true }).eq('id', next.id);
        }
        return NextResponse.json({ ok: true, message: `"${target?.label ?? 'הגרסה'}" נמחקה` });
      }

      return NextResponse.json({ error: 'פעולה לא מוכרת' }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get('file') as File | null;
    const label = String(form.get('label') ?? '').trim();
    const replaceId = String(form.get('replaceId') ?? '').trim();
    const asPrimary = String(form.get('asPrimary') ?? '') === '1';
    if (!file) return NextResponse.json({ error: 'לא נבחר קובץ' }, { status: 400 });

    const content = await fileToText(file);

    if (replaceId) {
      const { error } = await db.from('resumes')
        .update({ content, filename: file.name, quality_score: null, quality_notes: null, ...(label ? { label } : {}) })
        .eq('id', replaceId);
      if (error) throw new Error(error.message);
      const warning = await grade(replaceId, content);
      return NextResponse.json({ ok: true, replaced: true, warning, message: `הקובץ הוחלף · ${content.length.toLocaleString('he-IL')} תווים` });
    }

    const { count } = await db.from('resumes').select('*', { count: 'exact', head: true });
    const first = (count ?? 0) === 0;

    if (asPrimary || first) await db.from('resumes').update({ is_primary: false }).eq('is_primary', true);

    const { data: created, error } = await db.from('resumes')
      .insert({ label: label || `גרסה ${(count ?? 0) + 1}`, filename: file.name, content, is_primary: asPrimary || first })
      .select().single();
    if (error) throw new Error(error.message);

    const warning = await grade(created.id, content);
    return NextResponse.json({ ok: true, id: created.id, warning, message: `נשמר · ${content.length.toLocaleString('he-IL')} תווים` });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}

async function grade(id: string, content: string): Promise<string | undefined> {
  try {
    const g = await gradeResume(content);
    await db.from('resumes').update({ quality_score: g.score, quality_notes: { strengths: g.strengths, improvements: g.improvements } }).eq('id', id);
    return undefined;
  } catch (e: any) {
    return String(e?.message ?? e);
  }
}
