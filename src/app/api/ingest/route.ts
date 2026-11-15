import { NextResponse } from 'next/server';
import { db, primaryResume } from '@/lib/supabase';
import { analyzeJob } from '@/lib/scoring';
import { askJson } from '@/lib/gemini';
import { sourceFromUrl, type JobSource } from '@/lib/sources';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type Parsed = {
  title: string;
  company: string | null;
  location: string | null;
  scope: string | null;
  experience: string | null;
  description: string | null;
  requirements: string | null;
  recruiter: string | null;
  url: string | null;
};

type ParsedBatch = { jobs: Parsed[]; reject_reason: string | null };

/**
 * קליטת משרות מלינקדאין, מכתובת או מטקסט מודבק.
 *
 * הטקסט יכול להכיל **כמה משרות**, וזה העיקר: התראת מייל של לינקדאין
 * מכילה בדרך כלל שמונה עד עשר משרות. הדבקה אחת שלה מכניסה את כולן.
 *
 * למה לא סקרייפר: איסוף אוטומטי מלינקדאין מפר את תנאי השימוש ומסכן את
 * החשבון של זיו. התראות המייל הן ערוץ ההפצה שלינקדאין עצמה בנתה, והן
 * מבוססות על החיפוש שזיו הגדירה, ולכן הן גם איכותיות יותר מגרידה עיוורת.
 */
export async function POST(req: Request) {
  const startedAt = Date.now();
  const ANALYSIS_BUDGET_MS = 200000;

  try {
    const { url: rawUrl, text: rawText, dryRun } = await req.json();
    const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    let text = typeof rawText === 'string' ? rawText.trim() : '';

    if (!url && !text) {
      return NextResponse.json({ error: 'יש להזין כתובת משרה או להדביק את הטקסט שלה.' }, { status: 400 });
    }
    if (url && !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: 'הכתובת אינה תקינה. צריכה להתחיל ב-http או https.' }, { status: 400 });
    }

    if (url && !text) {
      let fetchNote: string | null = null;
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
            'Accept-Language': 'he,en;q=0.8',
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok) text = htmlToText(await res.text());
        else fetchNote = `העמוד החזיר שגיאה ${res.status}`;
      } catch (e: any) {
        fetchNote = e?.name === 'TimeoutError' ? 'העמוד לא ענה תוך 15 שניות' : String(e?.message ?? e);
      }

      const walled = !text || text.length < 400 || /sign in|join now|הרשמ|התחבר/i.test(text.slice(0, 600));
      if (walled) {
        return NextResponse.json({
          error: 'לא הצלחנו לקרוא את העמוד הזה אוטומטית. לינקדאין חוסם קריאה של חלק מהמשרות בלי התחברות.',
          hint: 'אפשר לפתוח את המשרה, לסמן את הטקסט, ולהדביק אותו. אפשר גם להדביק התראת מייל שלמה של לינקדאין, וכל המשרות שבה ייקלטו יחד.',
          needsText: true,
          detail: fetchNote,
        }, { status: 422 });
      }
    }

    const parsed = await askJson<ParsedBatch>(
      `הטקסט הבא נלקח מלינקדאין: עמוד משרה, פוסט, או **התראת מייל שמכילה כמה משרות**.
חלץ ממנו את כל המשרות שמופיעות בו.

חוקים:
1. אל תמציא שום שדה. אם שדה לא מופיע בטקסט, החזר null.
2. אם יש כמה משרות, החזר אותן כולן במערך. אם יש אחת, החזר מערך עם איבר אחד.
3. אם הטקסט אינו מכיל אף מודעת דרושים, החזר jobs=[] ונמק ב-reject_reason בעברית.
4. description הוא תיאור התפקיד. requirements הן הדרישות. אל תערבב ביניהם.
5. recruiter הוא שם האדם שמפרסם או שאליו פונים, אם מופיע. בפוסט זה בדרך כלל מי שכתב אותו. אם אין שם אדם, החזר null. אל תנחש.
6. url הוא הקישור הישיר למשרה אם הוא מופיע בטקסט. אם לא, החזר null.
7. בהתראת מייל יש לרוב רק כותרת, חברה ומיקום לכל משרה, בלי תיאור מלא. זה תקין: מלא מה שיש והשאר null.
8. שמור על הנוסח המקורי. אל תקצר ואל תשפר.
9. הכל בעברית אם המקור בעברית, ובאנגלית אם המקור באנגלית.

הטקסט:
${text.slice(0, 24000)}

החזר JSON בלבד:
{"reject_reason":null,"jobs":[{"title":"","company":null,"location":null,"scope":null,"experience":null,"description":null,"requirements":null,"recruiter":null,"url":null}]}`
    );

    const found = (parsed?.jobs ?? []).filter((j) => j?.title?.trim());
    if (!found.length) {
      return NextResponse.json(
        { error: parsed?.reject_reason || 'לא זוהתה אף מודעת דרושים בטקסט הזה.' },
        { status: 422 }
      );
    }

    // dryRun מחזיר את מה שזוהה בלי לכתוב למסד. משמש לבדיקת החילוץ
    // בלי להכניס משרות לרשימה של זיו.
    if (dryRun) {
      return NextResponse.json({
        ok: true, dryRun: true, found: found.length,
        jobs: found.map((j) => ({
          title: j.title, company: j.company, location: j.location, recruiter: j.recruiter,
        })),
      });
    }

    const resume = await primaryResume();
    const added: { title: string; score: number | null }[] = [];
    let duplicates = 0;
    let analyzed = 0;

    for (const job of found) {
      const jobUrl = (job.url && /^https?:\/\//i.test(job.url) ? job.url : '') || url;
      const source: JobSource = jobUrl ? sourceFromUrl(jobUrl) : 'linkedin';
      const externalId = buildExternalId(jobUrl, job, source);

      const { data: existing } = await db
        .from('jobs').select('id').eq('external_id', externalId).maybeSingle();
      if (existing) {
        await db.from('jobs').update({ last_seen_at: new Date().toISOString() }).eq('id', existing.id);
        duplicates++;
        continue;
      }

      const row: Record<string, any> = {
        external_id: externalId,
        url: jobUrl || 'about:blank',
        title: job.title,
        company: job.company,
        location: job.location,
        scope: job.scope,
        experience: job.experience,
        description: job.description,
        requirements: job.requirements,
        recruiter: job.recruiter,
        posted_at: new Date().toISOString().slice(0, 10),
        source,
      };

      // מנתחים כל עוד יש תקציב זמן. מה שלא נותח כאן ייקלט על ידי
      // הניתוח המתוזמן שרץ כל עשר דקות, ולכן שום משרה לא נשארת בלי ציון.
      if (resume?.content && Date.now() - startedAt < ANALYSIS_BUDGET_MS) {
        try {
          const a = await analyzeJob(job as any, resume.content);
          Object.assign(row, {
            score: a.score, ats_score: a.ats_score, hr_score: a.hr_score, rating: a.rating,
            summary: a.summary, responsibilities: a.responsibilities,
            key_requirements: a.key_requirements, buzzwords: a.buzzwords,
            score_reasons: a.score_reasons, analyzed_at: new Date().toISOString(),
          });
          analyzed++;
        } catch {
          /* נשמר בלי ציון, והמתזמן יטפל */
        }
      }

      const { data: saved } = await db.from('jobs').insert(row).select('title, score').single();
      if (saved) added.push({ title: saved.title, score: saved.score });
    }

    return NextResponse.json({
      ok: true,
      found: found.length,
      added: added.length,
      duplicates,
      analyzed,
      pending: added.length - analyzed,
      needsResume: !resume?.content,
      jobs: added,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}

/** מזהה יציב. למשרת לינקדאין לפי מספר המשרה, ולטקסט מודבק לפי תוכן. */
function buildExternalId(url: string, p: Parsed, source: string): string {
  const li = url.match(/\/jobs\/view\/(?:[^/]*-)?(\d{6,})/) ?? url.match(/currentJobId=(\d{6,})/);
  if (li) return `linkedin:${li[1]}`;
  const basis = `${p.title}|${p.company ?? ''}|${p.location ?? ''}`;
  return `${source}:${createHash('sha1').update(basis).digest('hex').slice(0, 16)}`;
}

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
