import { NextResponse } from 'next/server';
import { db, primaryResume } from '@/lib/supabase';
import { askJson } from '@/lib/gemini';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type BriefOut = {
  must_have: string[];
  nice_to_have: string[];
  do_not_claim: string[];
  headline: string;
  rewrite_rules: string[];
  bullet_examples: { instead_of: string; write: string }[];
  cover_opening: string;
};

/**
 * "כללי המפתח לסוכן".
 *
 * ההבדל בין זה לבין /api/tailor: tailor מחזיר קורות חיים מתוקנים.
 * זה מחזיר את **הכללים** בבלוק אחד שאפשר להעביר לסוכן אחר, כדי שזיו תעבוד
 * עם הסוכן שהיא כבר עובדת איתו ולא תהיה תלויה באתר הזה.
 *
 * הכלל החשוב פה: הסוכן לא ממציא ניסיון שאין לזיו. הפערים נרשמים
 * בפירוש כ"אסור לטעון", כדי שהבריף לא ייצור קורות חיים שקריים.
 */
export async function POST(req: Request) {
  try {
    const { jobId, refresh } = await req.json();
    if (!jobId) return NextResponse.json({ error: 'חסר מזהה משרה' }, { status: 400 });

    const { data: job } = await db.from('jobs').select('*').eq('id', jobId).single();
    if (!job) return NextResponse.json({ error: 'המשרה לא נמצאה' }, { status: 404 });

    const resume = await primaryResume();
    if (!resume?.content) {
      return NextResponse.json(
        { error: 'לא נמצאה גרסת קורות חיים ראשית. יש להעלות אחת בהגדרות.' },
        { status: 400 }
      );
    }

    // בריף קיים חוזר כמו שהוא, אלא אם ביקשו לייצר מחדש
    if (!refresh) {
      const { data: existing } = await db
        .from('agent_briefs').select('*')
        .eq('job_id', jobId).eq('resume_id', resume.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (existing) return NextResponse.json({ ok: true, cached: true, ...existing });
    }

    const jobText = [
      `כותרת: ${job.title}`,
      job.company ? `חברה: ${job.company}` : '',
      job.location ? `מיקום: ${job.location}` : '',
      job.scope ? `היקף: ${job.scope}` : '',
      job.experience ? `ניסיון נדרש: ${job.experience}` : '',
      job.description ? `תיאור:\n${job.description}` : '',
      job.requirements ? `דרישות:\n${job.requirements}` : '',
      job.key_requirements?.length ? `דרישות מרכזיות: ${job.key_requirements.join(', ')}` : '',
      job.buzzwords?.length ? `מונחי מפתח: ${job.buzzwords.join(', ')}` : '',
    ].filter(Boolean).join('\n');

    const prompt = `אתה קופירייטר גיוס בכיר שכותב קורות חיים בעברית למשרות שיווק בישראל, עם 15 שנה בתוך חדרי גיוס, ואתה יודע בדיוק מה מגייס מסנן בעשר השניות הראשונות ומה מערכת ATS מפספסת.

המטרה: זיו מחפשת תפקיד ג'וניור ראשון בשיווק, ללא ניסיון, עם תואר. היא עובדת עם סוכן AI אחר שמעצב ומשפר את קורות החיים שלה. התפקיד שלך הוא לא לכתוב את קורות החיים, אלא לייצר את **ההוראות** שהיא תעביר לסוכן ההוא.

המשרה:
${jobText}

קורות החיים של זיו כפי שהם היום:
${resume.content.slice(0, 7000)}

חוקים מחייבים:
1. אסור להמציא ניסיון, תפקיד, מספר או הישג שלא מופיע בקורות החיים. אם דרישה במשרה לא מכוסה, היא נכנסת ל-do_not_claim ולא לשום מקום אחר.
2. מותר ואף נדרש לנסח מחדש ניסיון אמיתי בשפת המשרה. ניסוח מחדש של דבר אמיתי זו עבודה נכונה. המצאה היא פסולה.
3. אם אין לזיו מספרים אמיתיים, אסור להציע מספרים לדוגמה. במקום זה יש להנחות אותה לשאול את עצמה היכן יש לה נתון אמיתי.
4. כל כלל ב-rewrite_rules הוא הוראה אחת ישירה לסוכן, בציווי, בשורה אחת.
5. ב-bullet_examples, השדה instead_of חייב להיות ציטוט או פראפרזה של משפט שקיים באמת בקורות החיים של זיו. אם אין משפט מתאים, אל תמציא אותו ואל תכלול את הדוגמה.
6. הכל בעברית. אסור להשתמש בתו מקף ארוך.

חשוב על זה שלב אחר שלב לפני שאתה כותב: קודם זהה אילו דרישות במשרה מכוסות באמת בקורות החיים, אחר כך אילו מכוסות חלקית ורק צריכות ניסוח אחר, ורק אחר כך אילו לא מכוסות בכלל. ההפרדה הזו היא כל התשובה.

החזר JSON בלבד במבנה הזה:
{
  "must_have": ["מונחים מהמשרה שחייבים להופיע בקורות החיים, עד 10"],
  "nice_to_have": ["מונחים שכדאי שיופיעו אם יש בסיס אמיתי, עד 6"],
  "do_not_claim": ["דרישות שזיו לא עומדת בהן, שאסור לטעון שהיא כן, עד 6"],
  "headline": "שורת כותרת אחת לראש קורות החיים, מכוונת למשרה הזו",
  "rewrite_rules": ["הוראה אחת לסוכן בכל שורה, עד 8"],
  "bullet_examples": [{"instead_of": "משפט שקיים בקורות החיים", "write": "אותו דבר בשפת המשרה"}],
  "cover_opening": "פסקת פתיחה למכתב מקדים, שתיים עד שלוש שורות"
}`;

    const out = await askJson<BriefOut>(prompt);

    // הבלוק שזיו מעתיקה. טקסט אחד, מוכן להדבקה אצל הסוכן שלה.
    const brief = [
      `הנחיות לעדכון קורות חיים למשרה: ${job.title}${job.company ? ` ב${job.company}` : ''}`,
      '',
      'רקע: אני מחפשת תפקיד ג׳וניור ראשון בשיווק, יש לי תואר ואין לי ניסיון בתחום.',
      'אל תמציא לי ניסיון, תפקיד, מספר או הישג שלא נמצא בקורות החיים שאשלח. מותר לנסח מחדש דברים אמיתיים בשפת המשרה.',
      '',
      'שורת כותרת מוצעת:',
      out.headline,
      '',
      'מונחים שחייבים להופיע:',
      ...(out.must_have ?? []).map((t) => `· ${t}`),
      '',
      ...((out.nice_to_have ?? []).length
        ? ['מונחים שכדאי שיופיעו, רק אם יש להם בסיס אמיתי:', ...(out.nice_to_have ?? []).map((t) => `· ${t}`), '']
        : []),
      'אסור לטעון שיש לי את אלה:',
      ...(out.do_not_claim ?? []).map((t) => `· ${t}`),
      '',
      'כללי כתיבה:',
      ...(out.rewrite_rules ?? []).map((t, i) => `${i + 1}. ${t}`),
      '',
      ...((out.bullet_examples ?? []).length
        ? [
            'דוגמאות לניסוח מחדש:',
            ...(out.bullet_examples ?? []).flatMap((b) => [`במקום: ${b.instead_of}`, `לכתוב: ${b.write}`, '']),
          ]
        : []),
      'פתיחה למכתב מקדים:',
      out.cover_opening,
    ].join('\n');

    const row = {
      job_id: jobId,
      resume_id: resume.id,
      brief,
      must_have: out.must_have ?? [],
      nice_to_have: out.nice_to_have ?? [],
      do_not_claim: out.do_not_claim ?? [],
    };

    const { data: saved, error } = await db.from('agent_briefs').insert(row).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, cached: false, ...saved });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
