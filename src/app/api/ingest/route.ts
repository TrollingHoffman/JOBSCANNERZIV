import { NextResponse } from 'next/server';
import { db, primaryResume } from '@/lib/supabase';
import { analyzeJob } from '@/lib/scoring';
import { askJson } from '@/lib/gemini';
import { sourceFromUrl } from '@/lib/sources';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type Parsed = {
  title: string;
  company: string | null;
  location: string | null;
  scope: string | null;
  experience: string | null;
  description: string | null;
  requirements: string | null;
  is_job: boolean;
  reject_reason: string | null;
};

/**
 * קליטת משרה בודדת מלינקדאין (או מכל מקור אחר), מכתובת או מטקסט מודבק.
 *
 * למה ככה ולא סקרייפר של לינקדאין:
 * סריקה אוטומטית של לינקדאין מפרה את תנאי השימוש שלהם ומסכנת את החשבון של זיו,
 * ולכן לא נבנתה. מה שכן נבנה: היא מצביעה על משרה אחת שהיא ראתה, או מדביקה
 * טקסט של פוסט או של התראת מייל, והמערכת מנתחת ומדרגת אותה כמו כל משרה אחרת.
 * זה גם הדרך היחידה שעובדת למשרות שמתפרסמות בפוסטים, שאין להן בכלל עמוד משרה.
 */
export async function POST(req: Request) {
  try {
    const { url: rawUrl, text: rawText } = await req.json();
    const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    let text = typeof rawText === 'string' ? rawText.trim() : '';

    if (!url && !text) {
      return NextResponse.json({ error: 'יש להזין כתובת משרה או להדביק את הטקסט שלה.' }, { status: 400 });
    }
    if (url && !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: 'הכתובת אינה תקינה. צריכה להתחיל ב-http או https.' }, { status: 400 });
    }

    // כתובת בלי טקסט: ניסיון אחד למשוך את העמוד הציבורי, בדיוק כמו שדפדפן עושה
    let fetchNote: string | null = null;
    if (url && !text) {
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
            'Accept-Language': 'he,en;q=0.8',
          },
          redirect: 'follow',
        });
        if (res.ok) {
          const html = await res.text();
          text = htmlToText(html);
        } else {
          fetchNote = `העמוד החזיר שגיאה ${res.status}`;
        }
      } catch (e: any) {
        fetchNote = String(e?.message ?? e);
      }

      const walled = !text || text.length < 400 || /sign in|join now|הרשמ|התחבר/i.test(text.slice(0, 600));
      if (walled) {
        return NextResponse.json({
          error: 'לא הצלחנו לקרוא את העמוד הזה אוטומטית. לינקדאין חוסם קריאה של חלק מהמשרות בלי התחברות.',
          hint: 'אפשר לפתוח את המשרה, לסמן את הטקסט שלה, ולהדביק אותו בשדה הטקסט. זה עובד גם למשרות שמתפרסמות בפוסט.',
          needsText: true,
          detail: fetchNote,
        }, { status: 422 });
      }
    }

    const parsed = await askJson<Parsed>(
      `הטקסט הבא נלקח מעמוד משרה או מפוסט בלינקדאין. חלץ ממנו את פרטי המשרה.

חוקים:
1. אל תמציא שום שדה. אם שדה לא מופיע בטקסט, החזר null.
2. אם הטקסט אינו מודעת דרושים בכלל (למשל פוסט כללי, מאמר, או עמוד שגיאה), החזר is_job=false ונמק ב-reject_reason בעברית.
3. description הוא תיאור התפקיד. requirements הן הדרישות. אל תערבב ביניהם.
4. שמור על הנוסח המקורי של התיאור והדרישות, בלי לקצר ובלי לשפר.
5. הכל בעברית אם המקור בעברית. אם המקור באנגלית, השאר באנגלית.

הטקסט:
${text.slice(0, 14000)}

החזר JSON בלבד:
{"is_job":true,"reject_reason":null,"title":"","company":null,"location":null,"scope":null,"experience":null,"description":null,"requirements":null}`
    );

    if (!parsed?.is_job || !parsed?.title) {
      return NextResponse.json(
        { error: parsed?.reject_reason || 'הטקסט הזה לא זוהה כמודעת דרושים.' },
        { status: 422 }
      );
    }

    const source = url ? sourceFromUrl(url) : 'manual';
    const externalId = buildExternalId(url, parsed, source);

    const { data: existing } = await db
      .from('jobs').select('id, title').eq('external_id', externalId).maybeSingle();
    if (existing) {
      await db.from('jobs').update({ last_seen_at: new Date().toISOString() }).eq('id', existing.id);
      return NextResponse.json({ ok: true, duplicate: true, jobId: existing.id, title: existing.title });
    }

    const row: Record<string, any> = {
      external_id: externalId,
      url: url || 'about:blank',
      title: parsed.title,
      company: parsed.company,
      location: parsed.location,
      scope: parsed.scope,
      experience: parsed.experience,
      description: parsed.description,
      requirements: parsed.requirements,
      posted_at: new Date().toISOString().slice(0, 10),
      source,
    };

    // ניתוח מיד, כדי שהמשרה תיכנס עם ציון ולא תחכה לסריקה הבאה
    const resume = await primaryResume();
    let analyzed = false;
    if (resume?.content) {
      try {
        const a = await analyzeJob(parsed as any, resume.content);
        Object.assign(row, {
          score: a.score, ats_score: a.ats_score, hr_score: a.hr_score, rating: a.rating,
          summary: a.summary, responsibilities: a.responsibilities,
          key_requirements: a.key_requirements, buzzwords: a.buzzwords,
          score_reasons: a.score_reasons, analyzed_at: new Date().toISOString(),
        });
        analyzed = true;
      } catch {
        // המשרה נשמרת גם אם הניתוח נכשל. /api/analyze יטפל בה אחר כך.
      }
    }

    const { data: saved, error } = await db.from('jobs').insert(row).select('id, title, score').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      duplicate: false,
      analyzed,
      jobId: saved.id,
      title: saved.title,
      score: saved.score,
      needsResume: !resume?.content,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}

/** מזהה יציב. למשרת לינקדאין לפי מספר המשרה, ולטקסט מודבק לפי תוכן. */
function buildExternalId(url: string, p: Parsed, source: string): string {
  const li = url.match(/\/jobs\/view\/(?:[^/]*-)?(\d{6,})/) ?? url.match(/currentJobId=(\d{6,})/);
  if (li) return `linkedin:${li[1]}`;
  const basis = `${p.title}|${p.company ?? ''}|${(p.requirements ?? p.description ?? '').slice(0, 300)}`;
  return `${source}:${createHash('sha1').update(basis).digest('hex').slice(0, 16)}`;
}

/** המרת HTML לטקסט קריא, בלי תלות בספרייה חיצונית. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|li|br|h[1-6]|tr|section)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
