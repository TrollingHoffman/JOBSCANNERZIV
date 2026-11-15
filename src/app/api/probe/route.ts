import { NextResponse } from 'next/server';
import { fetchPage, extractRefs, parseJsonLd, type BoardId } from '@/lib/boards';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * אבחון של קישור חיפוש.
 *
 * אומר מה באמת חזר מהלוח: האם הוא ענה, איזה סוג קישורים יש בעמוד,
 * וכמה משרות המתאם זיהה. בלי זה "0 משרות" יכול להיות גם חסימה,
 * גם דפוס קישור שגוי וגם חיפוש ריק באמת, ואין דרך להבדיל.
 *
 * מוגן באותו סוד של הסריקה, כי הוא מושך כתובת חיצונית לפי בקשה.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'לא מורשה' }, { status: 401 });
  }

  const url = new URL(req.url).searchParams.get('url');
  const board = (new URL(req.url).searchParams.get('board') ?? 'generic') as BoardId;
  if (!url) return NextResponse.json({ error: 'חסרה כתובת' }, { status: 400 });

  try {
    const html = await fetchPage(url, 20000);
    const refs = extractRefs(html, board);

    // דוגמית מהקישורים שבעמוד, כדי לראות את הדפוס האמיתי
    const hrefs = [...html.matchAll(/href="([^"]{4,120})"/g)].map((m) => m[1]);
    const jobish = hrefs.filter((h) => /job|position|vacancy|misra|drushim/i.test(h));
    const uniq = [...new Set(jobish)].slice(0, 25);

    return NextResponse.json({
      ok: true,
      status: 'fetched',
      bytes: html.length,
      refsFound: refs.length,
      sampleRefs: refs.slice(0, 5),
      hasJsonLd: /application\/ld\+json/.test(html),
      jsonLdJobPosting: !!parseJsonLd(html),
      sampleJobLinks: uniq,
      titleTag: html.match(/<title[^>]*>([^<]{0,120})/i)?.[1] ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 200 });
  }
}
