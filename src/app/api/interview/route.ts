import { NextResponse } from 'next/server';
import { db, primaryResume } from '@/lib/supabase';
import { askJson } from '@/lib/gemini';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type Question = { question: string; why: string; outline: string[] };
type PrepOut = { questions: Question[]; ask_them: string[] };

/**
 * הכנה לראיון, בנויה על הדרישות האמיתיות של המשרה ועל מה שבאמת כתוב
 * בקורות החיים של זיו.
 *
 * הכלל המרכזי: ראשי הפרקים לתשובה מורכבים רק מדברים שקיימים בקורות החיים.
 * תשובה שמסתמכת על ניסיון מומצא נשברת בראיון עצמו, ולכן זה לא שיפור אלא נזק.
 */
export async function POST(req: Request) {
  try {
    const { jobId, refresh } = await req.json();
    if (!jobId) return NextResponse.json({ error: 'חסר מזהה משרה' }, { status: 400 });

    const { data: job } = await db.from('jobs').select('*').eq('id', jobId).single();
    if (!job) return NextResponse.json({ error: 'המשרה לא נמצאה' }, { status: 404 });

    const resume = await primaryResume();
    if (!resume?.content) {
      return NextResponse.json({ error: 'לא נמצאו קורות חיים. יש להעלות בהגדרות.' }, { status: 400 });
    }

    if (!refresh) {
      const { data: existing } = await db
        .from('interview_preps').select('*')
        .eq('job_id', jobId).eq('resume_id', resume.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (existing) return NextResponse.json({ ok: true, cached: true, ...existing });
    }

    const jobText = [
      `כותרת: ${job.title}`,
      job.company ? `חברה: ${job.company}` : '',
      job.description ? `תיאור:\n${job.description}` : '',
      job.requirements ? `דרישות:\n${job.requirements}` : '',
      job.key_requirements?.length ? `דרישות מרכזיות: ${job.key_requirements.join(', ')}` : '',
    ].filter(Boolean).join('\n');

    const out = await askJson<PrepOut>(
      `את/ה מגייס/ת בכיר/ה בשוק הישראלי שמראיין/ת לתפקידי שיווק ג'וניור כבר 15 שנה, ויודע/ת בדיוק אילו שאלות באמת נשאלות בראיון לתפקיד כזה, להבדיל משאלות גנריות מרשימות באינטרנט.

המועמדת: זיו, מחפשת תפקיד ג'וניור ראשון בשיווק, בוגרת תואר, ללא ניסיון בתחום.

המשרה:
${jobText}

קורות החיים שלה:
${resume.content.slice(0, 7000)}

חוקים מחייבים:
1. כל שאלה נגזרת מדרישה אמיתית שמופיעה במשרה. בלי שאלות גנריות כמו "ספרי על עצמך" או "איפה את רואה את עצמך בעוד חמש שנים", אלא אם הן נובעות ישירות ממשהו שכתוב במשרה.
2. ראשי הפרקים לתשובה מורכבים **רק** מדברים שכתובים בקורות החיים. אסור להמציא ניסיון, מספר או פרויקט.
3. כשהשאלה נוגעת לפער אמיתי (דרישה שאין לה כיסוי), ראשי הפרקים יסבירו איך לענות **בכנות** על הפער ולחבר אותו לניסיון אמיתי קרוב, ולא איך להסתיר אותו.
4. השאלות לשאול אותם הן שאלות שמראות הבנה של התפקיד הספציפי הזה, לא שאלות כלליות על תרבות ארגונית.
5. הכל בעברית. אסור להשתמש בתו מקף ארוך.

חשוב שלב אחר שלב לפני שאתה כותב: עבור על הדרישות, סמן אילו מכוסות בקורות החיים ואילו לא, וגזור מכל אחת את השאלה שמגייס באמת ישאל עליה.

6 עד 8 שאלות. החזר JSON בלבד:
{"questions":[{"question":"","why":"מאיזו דרישה במשרה השאלה נובעת","outline":["ראשי פרקים לתשובה, 2 עד 4 נקודות"]}],"ask_them":["3 שאלות שכדאי שזיו תשאל"]}`
    );

    const row = {
      job_id: jobId,
      resume_id: resume.id,
      questions: out.questions ?? [],
      ask_them: out.ask_them ?? [],
    };

    const { data: saved, error } = await db.from('interview_preps').insert(row).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, cached: false, ...saved });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
