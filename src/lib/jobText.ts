/**
 * ניקוי טקסט משרה.
 *
 * מה שנשמר במסד מדרושים מכיל שלושה דברים שאינם המשרה:
 *  1. **כפילות** — שדה הדרישות פותח בכל תיאור המשרה מחדש.
 *  2. **ריהוט של האתר** — "קטגוריה", "תחומים", ורשימות תחומים.
 *  3. **שיווק של דרושים** — "רוצה לקבל עדכונים על המשרות לפני כולם?", "יצירת התראה".
 *
 * זה מה שנראה כמו רווח עצום בפופאפ: לא שטח ריק אלא אותו טקסט פעמיים
 * ועוד רעש. מנקים גם בהצגה וגם בפרסר, כדי ש-183 המשרות שכבר במסד
 * ייראו נכון ולא רק החדשות.
 */

/** כל מה שמופיע מכאן והלאה אינו חלק מהמשרה. */
const TAIL_MARKERS = [
  'רוצה לקבל עדכונים',
  'שמירת העדפות',
  'יצירת התראה',
  'משרות נוספות',
  'משרות דומות',
  'קטגוריה\n',
  'תחומים\n',
  'שלח/י קורות חיים',
  'הגש/י מועמדות',
  'שתף משרה',
  'דווח על מודעה',
];

/** כותרות שמסמנות את תחילת הדרישות בפועל. */
const REQ_HEADINGS = ['דרישות התפקיד', 'דרישות המשרה', 'דרישות:'];

function cutTail(text: string): string {
  let out = text;
  for (const m of TAIL_MARKERS) {
    const i = out.indexOf(m);
    if (i > 0) out = out.slice(0, i);
  }
  return out;
}

function tidy(text: string): string {
  return text
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[.\s•]+/, '')
    .trim();
}

/** תיאור המשרה, נקי מריהוט של האתר. */
export function cleanDescription(text: string | null | undefined): string {
  if (!text) return '';
  return tidy(cutTail(text));
}

/**
 * הדרישות בלבד.
 *
 * כשהשדה פותח בתיאור המשרה מחדש, חותכים עד לכותרת הדרישות.
 * אם אחרי הניקוי הדרישות זהות לתיאור, אין כאן מידע חדש ומחזירים ריק,
 * כדי שלא יוצג אותו טקסט פעמיים.
 */
export function cleanRequirements(
  requirements: string | null | undefined,
  description?: string | null
): string {
  if (!requirements) return '';
  let out = cutTail(requirements);

  for (const h of REQ_HEADINGS) {
    const i = out.indexOf(h);
    if (i >= 0) {
      out = out.slice(i + h.length);
      break;
    }
  }

  out = tidy(out);
  if (!out) return '';

  const desc = tidy(cutTail(description ?? ''));
  if (desc && (out === desc || desc.includes(out) || out.includes(desc))) {
    // הדרישות לא הוסיפו דבר על התיאור
    const extra = out.replace(desc, '').trim();
    return extra.length > 40 ? tidy(extra) : '';
  }
  return out;
}
