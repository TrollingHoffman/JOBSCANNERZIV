/** מקורות המשרות. המקור נשמר על כל משרה כדי שיהיה ברור מאיפה היא הגיעה. */

export type JobSource = 'drushim' | 'linkedin' | 'manual';

export function sourceLabel(source: string | null | undefined): string {
  switch (source) {
    case 'linkedin': return 'לינקדאין';
    case 'manual': return 'הוספה ידנית';
    case 'drushim':
    default: return 'דרושים';
  }
}

/** זיהוי המקור מתוך כתובת, לסימון נכון של משרה שנוספה ידנית. */
export function sourceFromUrl(url: string): JobSource {
  const u = url.toLowerCase();
  if (u.includes('linkedin.com')) return 'linkedin';
  if (u.includes('drushim.co.il')) return 'drushim';
  return 'manual';
}
