import * as cheerio from 'cheerio';

/**
 * מתאם כללי ללוחות משרות.
 *
 * למה כללי ולא פרסר לכל אתר: AllJobs ו-JobMaster חוסמים קריאה אוטומטית
 * מכתובות שאינן דפדפן, ולכן אי אפשר לכתוב סלקטורים לפי בדיקה שלהם מראש.
 * במקום לנחש מבנה HTML, המתאם נשען על **JSON-LD מסוג JobPosting**: זה תקן
 * schema.org שלוחות משרות מפרסמים בכוונה כדי להופיע ב-Google Jobs, הוא יציב
 * הרבה יותר מ-class names, והוא זהה בכל הלוחות.
 *
 * אם אין JSON-LD, יש נפילה לטקסט הגולמי, והמנתח מחלץ ממנו.
 */

export type BoardId = 'drushim' | 'alljobs' | 'jobmaster' | 'generic';

export type BoardJobRef = { externalId: string; url: string };

export type BoardDetail = {
  externalId: string;
  url: string;
  title: string;
  company: string | null;
  location: string | null;
  scope: string | null;
  experience: string | null;
  description: string | null;
  requirements: string | null;
  postedAt: string | null;
};

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

type BoardSpec = {
  label: string;
  /** דפוסי קישור למשרה בתוך עמוד תוצאות */
  jobLink: RegExp;
  /** בונה כתובת מלאה ממזהה */
  jobUrl: (id: string, raw: string) => string;
  pageParam: string;
};

export const BOARDS: Record<Exclude<BoardId, 'generic'>, BoardSpec> = {
  drushim: {
    label: 'דרושים',
    jobLink: /\/job\/(\d+)\/([0-9a-fA-F]+)\/?/g,
    jobUrl: (id, raw) => `https://www.drushim.co.il/job/${id}/${raw}/`,
    pageParam: 'page',
  },
  alljobs: {
    label: 'AllJobs',
    // הדפוס האמיתי, נקרא מהעמוד עצמו ולא מניחוש:
    // /Search/UploadSingle.aspx?JobID=8865845
    // נתיב המובייל /m/p/jobs/{id} קיים גם הוא ומטופל כאן.
    jobLink: /(?:JobID=(\d{5,})|\/m\/p\/jobs\/(\d{5,}))/g,
    jobUrl: (id) => `https://www.alljobs.co.il/Search/UploadSingle.aspx?JobID=${id}`,
    pageParam: 'page',
  },
  jobmaster: {
    label: 'JobMaster',
    jobLink: /\/jobs?\/(\d{4,})/g,
    jobUrl: (id) => `https://www.jobmaster.co.il/jobs/${id}/`,
    pageParam: 'page',
  },
};

export function boardLabel(board: string): string {
  return (BOARDS as any)[board]?.label ?? 'לוח אחר';
}

/** בקשה בודדת עם תקרת זמן. עמוד שלא עונה לא מפיל את הסריקה. */
export async function fetchPage(url: string, timeoutMs = 15000): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    cache: 'no-store',
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status === 403 || res.status === 429) {
    throw new Error(`הלוח חסם את הבקשה (${res.status}). ייתכן שהוא חוסם קריאה אוטומטית.`);
  }
  if (!res.ok) throw new Error(`הלוח החזיר ${res.status}`);
  return res.text();
}

function withPage(url: string, page: number, param: string): string {
  const u = new URL(url);
  if (page > 1) u.searchParams.set(param, String(page));
  return u.toString();
}

export function detectBoard(url: string): BoardId {
  const u = url.toLowerCase();
  if (u.includes('drushim.co.il')) return 'drushim';
  if (u.includes('alljobs.co.il')) return 'alljobs';
  if (u.includes('jobmaster.co.il')) return 'jobmaster';
  return 'generic';
}

/** מזהי משרות מתוך עמוד תוצאות אחד. */
export function extractRefs(html: string, board: BoardId): BoardJobRef[] {
  const spec = (BOARDS as any)[board] as BoardSpec | undefined;
  const seen = new Map<string, BoardJobRef>();

  if (spec) {
    const re = new RegExp(spec.jobLink.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      // דפוס עם כמה חלופות: לוקחים את הקבוצה שנתפסה בפועל
      const id = m.slice(1).find((g) => g && /^\d+$/.test(g));
      if (!id || seen.has(id)) continue;
      const extra = m.slice(1).find((g) => g && !/^\d+$/.test(g)) ?? '';
      seen.set(id, { externalId: id, url: spec.jobUrl(id, extra) });
    }
    return [...seen.values()];
  }

  // לוח לא מוכר: כל קישור שנראה כמו עמוד משרה
  const $ = cheerio.load(html);
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const m = href.match(/\/(?:job|jobs|position|vacancy)[/-](\d{4,})/i);
    if (m && !seen.has(m[1])) {
      seen.set(m[1], { externalId: m[1], url: new URL(href, 'https://example.com').toString() });
    }
  });
  return [...seen.values()];
}

export async function collectRefs(searchUrl: string, board: BoardId, maxPages = 3): Promise<BoardJobRef[]> {
  const spec = (BOARDS as any)[board] as BoardSpec | undefined;
  const param = spec?.pageParam ?? 'page';
  const all = new Map<string, BoardJobRef>();

  for (let page = 1; page <= maxPages; page++) {
    let html: string;
    try {
      html = await fetchPage(withPage(searchUrl, page, param));
    } catch (e) {
      // עמוד ראשון שנכשל הוא כשל אמיתי של החיפוש, ויש לדווח עליו
      if (page === 1) throw e;
      break;
    }
    const before = all.size;
    for (const r of extractRefs(html, board)) {
      // קישורים יחסיים בלוח לא מוכר מתוקנים מול כתובת החיפוש
      const abs = r.url.startsWith('http') ? r.url : new URL(r.url, searchUrl).toString();
      all.set(r.externalId, { ...r, url: abs });
    }
    if (all.size === before) break;
    await sleep(700 + Math.random() * 400);
  }
  return [...all.values()];
}

/**
 * JobPosting לפי schema.org, אם הלוח מפרסם אותו.
 * זה המסלול המועדף: הלוחות מפרסמים את זה בכוונה עבור Google Jobs,
 * והוא לא נשבר כשהם משנים עיצוב.
 */
export function parseJsonLd(html: string): Partial<BoardDetail> | null {
  const $ = cheerio.load(html);
  const blocks: any[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text().trim();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      Array.isArray(parsed) ? blocks.push(...parsed) : blocks.push(parsed);
    } catch {
      /* בלוק פגום הוא לא סיבה להפיל את העמוד */
    }
  });

  const flat: any[] = [];
  for (const b of blocks) {
    flat.push(b);
    if (Array.isArray(b?.['@graph'])) flat.push(...b['@graph']);
  }

  const posting = flat.find((b) => {
    const t = b?.['@type'];
    return t === 'JobPosting' || (Array.isArray(t) && t.includes('JobPosting'));
  });
  if (!posting) return null;

  const loc = posting.jobLocation;
  const addr = (Array.isArray(loc) ? loc[0] : loc)?.address;
  const location =
    addr?.addressLocality || addr?.addressRegion || (typeof loc === 'string' ? loc : null) || null;

  return {
    title: typeof posting.title === 'string' ? posting.title.trim() : undefined,
    company:
      (typeof posting.hiringOrganization === 'string'
        ? posting.hiringOrganization
        : posting.hiringOrganization?.name) ?? null,
    location,
    scope: Array.isArray(posting.employmentType)
      ? posting.employmentType.join(', ')
      : posting.employmentType ?? null,
    description: posting.description ? stripHtml(String(posting.description)) : null,
    postedAt: typeof posting.datePosted === 'string' ? posting.datePosted.slice(0, 10) : null,
  };
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|li|br|h[1-6]|tr|section)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .split('\n').map((l) => l.trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** טקסט נקי של עמוד, לנפילה כשאין JSON-LD. */
export function pageText(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, nav, header, footer, noscript').remove();
  return stripHtml($.html()).slice(0, 14000);
}

/** פיצול תיאור לדרישות, כששניהם הגיעו כגוש אחד. */
export function splitRequirements(text: string): { description: string; requirements: string | null } {
  const markers = ['דרישות התפקיד', 'דרישות המשרה', 'דרישות:', 'דרישות', 'Requirements'];
  for (const m of markers) {
    const i = text.indexOf(m);
    if (i > 40) {
      return {
        description: text.slice(0, i).trim(),
        requirements: text.slice(i + m.length).trim() || null,
      };
    }
  }
  return { description: text, requirements: null };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
