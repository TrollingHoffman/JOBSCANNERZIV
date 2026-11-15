import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

export type JobRef = { externalId: string; url: string };
export type JobDetail = {
  externalId: string; url: string; title: string;
  company: string | null; location: string | null; scope: string | null; experience: string | null;
  description: string | null; requirements: string | null; logoUrl: string | null; postedAt: string | null;
};

/**
 * בקשה בודדת לדרושים, עם תקרת זמן.
 *
 * בלי התקרה הזו בקשה אחת שנתקעת מפילה את כל הסריקה: הפונקציה ב-Vercel
 * נהרגת אחרי 300 שניות, ושום משרה לא נשמרת. עדיף לוותר על עמוד אחד
 * ולהמשיך, מאשר לאבד את הסריקה כולה.
 */
async function fetchHtml(url: string, timeoutMs = 15000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'he-IL,he;q=0.9', Accept: 'text/html,application/xhtml+xml' },
      cache: 'no-store',
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`drushim החזיר ${res.status}`);
    return await res.text();
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error(`דרושים לא ענה תוך ${Math.round(timeoutMs / 1000)} שניות`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export function extractJobRefs(html: string): JobRef[] {
  const seen = new Map<string, JobRef>();
  const re = /\/job\/(\d+)\/([0-9a-fA-F]+)\/?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) if (!seen.has(m[1])) seen.set(m[1], { externalId: m[1], url: `https://www.drushim.co.il/job/${m[1]}/${m[2]}/` });
  return [...seen.values()];
}

function withPage(url: string, page: number): string {
  const u = new URL(url);
  if (page > 1) u.searchParams.set('page', String(page));
  return u.toString();
}

export async function collectJobRefs(searchUrl: string, maxPages = 3): Promise<JobRef[]> {
  const all = new Map<string, JobRef>();
  for (let page = 1; page <= maxPages; page++) {
    let html: string;
    try { html = await fetchHtml(withPage(searchUrl, page)); } catch { break; }
    const before = all.size;
    extractJobRefs(html).forEach((r) => all.set(r.externalId, r));
    if (all.size === before) break;
    await sleep(700 + Math.random() * 400);
  }
  return [...all.values()];
}

export function parseRelativeDate(text: string, now = new Date()): string | null {
  const t = text.replace(/\s+/g, ' ').trim();
  const d = new Date(now);
  if (/\u05d4\u05d9\u05d5\u05dd/.test(t)) return iso(d);
  if (/\u05d0\u05ea\u05de\u05d5\u05dc/.test(t)) { d.setDate(d.getDate() - 1); return iso(d); }
  const m = t.match(/\u05dc\u05e4\u05e0\u05d9\s+(\d+)?\s*(\u05d3\u05e7\u05d4|\u05d3\u05e7\u05d5\u05ea|\u05e9\u05e2\u05d4|\u05e9\u05e2\u05d5\u05ea|\u05d9\u05d5\u05dd|\u05d9\u05de\u05d9\u05dd|\u05e9\u05d1\u05d5\u05e2|\u05e9\u05d1\u05d5\u05e2\u05d5\u05ea|\u05d7\u05d5\u05d3\u05e9|\u05d7\u05d5\u05d3\u05e9\u05d9\u05dd)/);
  if (!m) return null;
  const n = m[1] ? parseInt(m[1], 10) : 1;
  const unit = m[2];
  if (/\u05d3\u05e7\u05d4|\u05d3\u05e7\u05d5\u05ea|\u05e9\u05e2\u05d4|\u05e9\u05e2\u05d5\u05ea/.test(unit)) return iso(d);
  if (/\u05d9\u05d5\u05dd|\u05d9\u05de\u05d9\u05dd/.test(unit)) d.setDate(d.getDate() - n);
  else if (/\u05e9\u05d1\u05d5\u05e2/.test(unit)) d.setDate(d.getDate() - n * 7);
  else if (/\u05d7\u05d5\u05d3\u05e9/.test(unit)) d.setMonth(d.getMonth() - n);
  return iso(d);
}

function iso(d: Date) { return d.toISOString().slice(0, 10); }
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

export function parseJobPage(html: string, ref: JobRef, now = new Date()): JobDetail {
  const withBreaks = html.replace(/<\/(p|div|li|ul|ol|h1|h2|h3|h4|h5|section|article|tr|td)>|<br\s*\/?>/gi, '\n$&');
  const $ = cheerio.load(withBreaks);
  const logoUrl = $('img[src*="/logos/"]').first().attr('src') ?? null;
  $('script, style, nav, header, footer, noscript, svg').remove();

  const title = ($('h1').first().text() || '').trim() || metaTitle($);
  const bodyText = $('body').text().split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');

  const DESC = ['\u05ea\u05d9\u05d0\u05d5\u05e8 \u05de\u05e9\u05e8\u05d4', '\u05ea\u05d9\u05d0\u05d5\u05e8 \u05d4\u05ea\u05e4\u05e7\u05d9\u05d3'];
  const REQ = ['\u05d3\u05e8\u05d9\u05e9\u05d5\u05ea \u05d4\u05ea\u05e4\u05e7\u05d9\u05d3', '\u05d3\u05e8\u05d9\u05e9\u05d5\u05ea \u05d4\u05de\u05e9\u05e8\u05d4'];
  const TAIL = ['\u05de\u05e9\u05e8\u05d5\u05ea \u05e0\u05d5\u05e1\u05e4\u05d5\u05ea', '\u05de\u05e9\u05e8\u05d5\u05ea \u05d3\u05d5\u05de\u05d5\u05ea', '\u05d4\u05d2\u05e9\u05ea \u05de\u05d5\u05e2\u05de\u05d3\u05d5\u05ea', '\u05e9\u05dc\u05d7 \u05e7\u05d5\u05e8\u05d5\u05ea \u05d7\u05d9\u05d9\u05dd', '\u05d4\u05d3\u05e8\u05da \u05d4\u05d7\u05db\u05de\u05d4 \u05dc\u05d4\u05ea\u05e7\u05d3\u05dd', '\u05e8\u05d5\u05e6\u05d4 \u05dc\u05d4\u05d1\u05d9\u05df \u05de\u05d4 \u05d1\u05de\u05e9\u05e8\u05d4'];

  const relative = firstMatch(bodyText, RELATIVE_HINT);

  return {
    externalId: ref.externalId, url: ref.url,
    title: title || '\u05de\u05e9\u05e8\u05d4 \u05dc\u05dc\u05d0 \u05db\u05d5\u05ea\u05e8\u05ea',
    company: guessCompany($, title),
    location: firstMatch(bodyText, LOCATION_HINT),
    scope: firstMatch(bodyText, SCOPE_HINT),
    experience: firstMatch(bodyText, EXPERIENCE_HINT),
    description: sliceSection(bodyText, DESC, [...REQ, ...TAIL]) || metaDescription($),
    requirements: sliceSection(bodyText, REQ, TAIL),
    logoUrl: logoUrl && logoUrl.startsWith('http') ? logoUrl : null,
    postedAt: relative ? parseRelativeDate(relative, now) : null,
  };
}

const LOCATION_HINT = new RegExp('(' + ['\u05ea\u05dc \u05d0\u05d1\u05d9\u05d1','\u05d9\u05e8\u05d5\u05e9\u05dc\u05d9\u05dd','\u05d7\u05d9\u05e4\u05d4','\u05d1\u05d0\u05e8 \u05e9\u05d1\u05e2','\u05e8\u05d0\u05e9\u05d5\u05df \u05dc\u05e6\u05d9\u05d5\u05df','\u05e4\u05ea\u05d7 \u05ea\u05e7\u05d5\u05d5\u05d4','\u05e0\u05ea\u05e0\u05d9\u05d4','\u05e8\u05de\u05ea \u05d2\u05df','\u05d4\u05e8\u05e6\u05dc\u05d9\u05d4 \u05e4\u05d9\u05ea\u05d5\u05d7','\u05d4\u05e8\u05e6\u05dc\u05d9\u05d4','\u05db\u05e4\u05e8 \u05e1\u05d1\u05d0','\u05e8\u05e2\u05e0\u05e0\u05d4','\u05d4\u05d5\u05d3 \u05d4\u05e9\u05e8\u05d5\u05df','\u05e8\u05d0\u05e9 \u05d4\u05e2\u05d9\u05df','\u05d7\u05d5\u05dc\u05d5\u05df','\u05d1\u05ea \u05d9\u05dd','\u05e8\u05d7\u05d5\u05d1\u05d5\u05ea','\u05e0\u05e1 \u05e6\u05d9\u05d5\u05e0\u05d4','\u05de\u05d5\u05d3\u05d9\u05e2\u05d9\u05df','\u05dc\u05d5\u05d3','\u05e8\u05de\u05dc\u05d4','\u05d0\u05e9\u05d3\u05d5\u05d3','\u05d0\u05e9\u05e7\u05dc\u05d5\u05df','\u05db\u05e4\u05e8 \u05d9\u05d5\u05e0\u05d4','\u05e7\u05d3\u05d9\u05de\u05d4','\u05e6\u05d5\u05e8\u05df','\u05d0\u05d1\u05df \u05d9\u05d4\u05d5\u05d3\u05d4','\u05ea\u05dc \u05de\u05d5\u05e0\u05d3','\u05d7\u05d3\u05e8\u05d4','\u05db\u05d5\u05db\u05d1 \u05d9\u05d0\u05d9\u05e8','\u05e6\u05d5\u05e8 \u05d9\u05e6\u05d7\u05e7','\u05d9\u05d4\u05d5\u05d3','\u05d0\u05d5\u05e8 \u05d9\u05d4\u05d5\u05d3\u05d4','\u05d2\u05d1\u05e2\u05ea\u05d9\u05d9\u05dd','\u05e7\u05e8\u05d9\u05ea \u05d0\u05d5\u05e0\u05d5','\u05e9\u05d5\u05d4\u05dd','\u05d1\u05e0\u05d9 \u05d1\u05e8\u05e7','\u05e6\u05e8\u05d9\u05e4\u05d9\u05df','\u05d1\u05d0\u05e8 \u05d9\u05e2\u05e7\u05d1','\u05d0\u05e8\u05d9\u05d0\u05dc'].join('|') + ')');
const SCOPE_HINT = new RegExp('(' + ['\u05de\u05e9\u05e8\u05d4 \u05de\u05dc\u05d0\u05d4','\u05de\u05e9\u05e8\u05d4 \u05d7\u05dc\u05e7\u05d9\u05ea','\u05de\u05e9\u05de\u05e8\u05d5\u05ea','\u05d4\u05d9\u05d1\u05e8\u05d9\u05d3\u05d9','\u05e2\u05d1\u05d5\u05d3\u05d4 \u05de\u05d4\u05d1\u05d9\u05ea','\u05de\u05e9\u05e8\u05d4 \u05d6\u05de\u05e0\u05d9\u05ea'].join('|') + ')');
const EXPERIENCE_HINT = new RegExp('(\u05dc\u05dc\u05d0 \u05e0\u05e1\u05d9\u05d5\u05df|\u05dc\u05dc\u05d0 \u05e0\u05d9\u05e1\u05d9\u05d5\u05df|\\d+\\s*-\\s*\\d+\\s*\u05e9\u05e0\u05d5\u05ea \u05e0\u05d9\u05e1\u05d9\u05d5\u05df|\\d+\\s*\u05e9\u05e0\u05d5\u05ea \u05e0\u05d9\u05e1\u05d9\u05d5\u05df)');
const RELATIVE_HINT = new RegExp('(\u05dc\u05e4\u05e0\u05d9\\s+\\d*\\s*(?:\u05d3\u05e7\u05d4|\u05d3\u05e7\u05d5\u05ea|\u05e9\u05e2\u05d4|\u05e9\u05e2\u05d5\u05ea|\u05d9\u05d5\u05dd|\u05d9\u05de\u05d9\u05dd|\u05e9\u05d1\u05d5\u05e2|\u05e9\u05d1\u05d5\u05e2\u05d5\u05ea|\u05d7\u05d5\u05d3\u05e9|\u05d7\u05d5\u05d3\u05e9\u05d9\u05dd)|\u05d0\u05ea\u05de\u05d5\u05dc|\u05d4\u05d9\u05d5\u05dd)');

function metaTitle($: any) { return ($('meta[property="og:title"]').attr('content') ?? '').split('|')[0].trim(); }
function metaDescription($: any) { return $('meta[name="description"]').attr('content')?.trim() ?? null; }
function guessCompany($: any, title: string) {
  const og = $('meta[property="og:title"]').attr('content') ?? '';
  const before = og.split('|')[0].trim();
  if (!before) return null;
  const clean = title.replace(/\s+/g, ' ').trim();
  if (clean && before.startsWith(clean)) {
    const rest = before.slice(clean.length).replace(/^\s*[-\u2013]\s*/, '').trim();
    return rest || null;
  }
  const parts = before.split(' - ');
  return parts.length > 1 ? parts[parts.length - 1].trim() : null;
}
function firstMatch(text: string, re: RegExp) { const m = text.match(re); return m ? m[0].trim() : null; }
function sliceSection(text: string, headings: string[], stops: string[]): string | null {
  for (const h of headings) {
    const idx = text.indexOf(h);
    if (idx === -1) continue;
    const rest = text.slice(idx + h.length);
    let end = rest.length;
    for (const s of stops) { const si = rest.indexOf(s); if (si !== -1 && si < end) end = si; }
    const out = rest.slice(0, end).trim();
    if (out.length > 15) return out;
  }
  return null;
}

export async function fetchJobDetail(ref: JobRef): Promise<JobDetail> {
  return parseJobPage(await fetchHtml(ref.url), ref);
}

export { sleep };
