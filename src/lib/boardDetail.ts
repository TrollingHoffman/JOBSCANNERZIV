import { askJson } from './gemini';
import {
  fetchPage, parseJsonLd, pageText, splitRequirements,
  type BoardDetail, type BoardId, type BoardJobRef,
} from './boards';
import { parseJobPage } from './drushim';

/**
 * פרטי משרה מלוח כלשהו.
 *
 * סדר העדיפות מכוון: קודם הפרסר של דרושים שכבר נבדק מול המבנה האמיתי,
 * אחריו JSON-LD שהלוחות מפרסמים בכוונה, ורק בסוף חילוץ בעזרת מודל.
 * כל שלב שנכשל נופל לבא אחריו, כך שלוח שמשנה עיצוב לא שובר את הסריקה.
 */
export async function fetchBoardDetail(ref: BoardJobRef, board: BoardId): Promise<BoardDetail> {
  const html = await fetchPage(ref.url);

  if (board === 'drushim') {
    const d = parseJobPage(html, ref as any);
    return {
      externalId: ref.externalId, url: ref.url, title: d.title,
      company: d.company, location: d.location, scope: d.scope, experience: d.experience,
      description: d.description, requirements: d.requirements, postedAt: d.postedAt,
    };
  }

  const ld = parseJsonLd(html);
  if (ld?.title) {
    const split = ld.description ? splitRequirements(ld.description) : { description: null, requirements: null };
    return {
      externalId: ref.externalId,
      url: ref.url,
      title: ld.title,
      company: ld.company ?? null,
      location: ld.location ?? null,
      scope: ld.scope ?? null,
      experience: null,
      description: split.description,
      requirements: split.requirements,
      postedAt: ld.postedAt ?? null,
    };
  }

  // אין JSON-LD: מחלצים מהטקסט, עם איסור מפורש על המצאה
  const text = pageText(html);
  if (text.length < 200) throw new Error('העמוד חזר כמעט ריק, ככל הנראה נחסם');

  const out = await askJson<{
    is_job: boolean; title: string; company: string | null; location: string | null;
    scope: string | null; experience: string | null;
    description: string | null; requirements: string | null;
  }>(
    `הטקסט הבא הוא עמוד משרה מלוח דרושים ישראלי. חלץ ממנו את פרטי המשרה.

חוקים:
1. אל תמציא שום שדה. אם שדה לא מופיע בטקסט, החזר null.
2. אם זה אינו עמוד משרה, החזר is_job=false.
3. description הוא תיאור התפקיד, requirements הן הדרישות. אל תערבב.
4. שמור על הנוסח המקורי, בלי לקצר ובלי לשפר.
5. אסור להשתמש בתו מקף ארוך.

הטקסט:
${text}

החזר JSON בלבד:
{"is_job":true,"title":"","company":null,"location":null,"scope":null,"experience":null,"description":null,"requirements":null}`
  );

  if (!out?.is_job || !out?.title) throw new Error('העמוד לא זוהה כמודעת דרושים');

  return {
    externalId: ref.externalId, url: ref.url, title: out.title,
    company: out.company, location: out.location, scope: out.scope, experience: out.experience,
    description: out.description, requirements: out.requirements, postedAt: null,
  };
}
