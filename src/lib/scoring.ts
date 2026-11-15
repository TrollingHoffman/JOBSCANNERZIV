import { askJson } from './gemini';
import { extractTerms, matchedCategories } from './keywords';

export type Analysis = {
  score: number; ats_score: number; hr_score: number; rating: string; summary: string;
  responsibilities: string[]; key_requirements: string[]; buzzwords: string[];
  score_reasons: { strengths: string[]; gaps: string[] };
};

type JobLike = {
  title: string; company?: string | null; location?: string | null; scope?: string | null;
  experience?: string | null; description?: string | null; requirements?: string | null; buzzwords?: string[];
};

const SYSTEM = `את/ה מנתח/ת התאמה בין קורות חיים למשרות בשוק העבודה הישראלי.
כל הפלט בעברית תקנית, בלי סופרלטיבים. אל תמציא מידע. אסור להשתמש בתו מקף ארוך. מחזיר/ה JSON בלבד.`;

export function ratingFor(score: number): string {
  if (score >= 80) return 'התאמה מצוינת';
  if (score >= 65) return 'התאמה חזקה';
  if (score >= 50) return 'תחרותי';
  if (score >= 35) return 'התאמה חלקית';
  return 'התאמה נמוכה';
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

export async function analyzeJob(job: JobLike, cvText: string): Promise<Analysis> {
  const jobText = [job.title, job.company, job.description, job.requirements].filter(Boolean).join('\n');
  const seedTerms = extractTerms(jobText);
  const categories = matchedCategories(jobText);

  const prompt = `## המשרה
כותרת: ${job.title}
חברה: ${job.company ?? 'לא צוין'}
מיקום: ${job.location ?? 'לא צוין'}
היקף: ${job.scope ?? 'לא צוין'}
ניסיון: ${job.experience ?? 'לא צוין'}

תיאור:
${job.description ?? 'לא צוין'}

דרישות:
${job.requirements ?? 'לא צוין'}

תחומים שזוהו: ${categories.join(', ') || 'אין'}
מונחים שזוהו: ${seedTerms.join(', ') || 'אין'}

## קורות החיים
${cvText.slice(0, 12000)}

## המשימה
ats_score (0-100): 22% חפיפת מונחים, 22% קרבה תוכנית, 18% מונחי תחום, 13% ביטויים משותפים, 13% מרכזיות, 7% כישורים משתמעים, 5% עדכניות.
hr_score (0-100): 30% ניסיון, 25% רלוונטיות תפקידים, 20% השכלה, 15% רמת תפקיד, 10% רצף.
score: 55% ats + 45% hr, מעוגל.

החזר/י JSON:
{
  "ats_score": מספר, "hr_score": מספר, "score": מספר,
  "summary": "2-3 שורות",
  "responsibilities": ["3-5"],
  "key_requirements": ["3-6"],
  "buzzwords": ["8-14 מונחים בשפה המקורית"],
  "score_reasons": { "strengths": ["2-4"], "gaps": ["2-4"] }
}`;

  const out = await askJson<Analysis>(prompt, SYSTEM);
  const ats = clamp(out.ats_score);
  const hr = clamp(out.hr_score);
  const score = clamp(out.score ?? ats * 0.55 + hr * 0.45);

  return {
    ...out, ats_score: ats, hr_score: hr, score, rating: ratingFor(score),
    responsibilities: out.responsibilities?.slice(0, 6) ?? [],
    key_requirements: out.key_requirements?.slice(0, 8) ?? [],
    buzzwords: dedupe([...(out.buzzwords ?? []), ...seedTerms]).slice(0, 16),
    score_reasons: out.score_reasons ?? { strengths: [], gaps: [] },
  };
}

export type ResumeGrade = { score: number; strengths: string[]; improvements: string[] };

export async function gradeResume(cvText: string): Promise<ResumeGrade> {
  const out = await askJson<ResumeGrade>(
    `לפניך קורות חיים של מועמדת לתפקידי שיווק.\n\n${cvText.slice(0, 12000)}\n\nתן/י ציון איכות 0-100 לפי בהירות, מונחים מקצועיים, הישגים מדידים וקריאות למערכות סינון.\n\nJSON: { "score": מספר, "strengths": ["2-4"], "improvements": ["2-5"] }`,
    SYSTEM
  );
  return { score: clamp(out.score), strengths: out.strengths?.slice(0, 5) ?? [], improvements: out.improvements?.slice(0, 6) ?? [] };
}

export type TailoringResult = {
  headline: string; summary: string;
  edits: { section: string; current: string; suggested: string; why: string }[];
  add_keywords: string[]; gaps: string[]; cover_letter: string;
};

export async function tailorResume(job: JobLike, cvText: string): Promise<TailoringResult> {
  const out = await askJson<TailoringResult>(
    `## המשרה\n${job.title}${job.company ? `, ${job.company}` : ''}\n\nתיאור:\n${job.description ?? ''}\n\nדרישות:\n${job.requirements ?? ''}\n\nמונחי מפתח: ${(job.buzzwords ?? []).join(', ')}\n\n## קורות החיים\n${cvText.slice(0, 12000)}\n\n## המשימה\nאין להמציא ניסיון או מספרים. מותר לנסח מחדש ולחדד. כל שינוי מוכן להעתקה.\n\nJSON:\n{ "headline": "", "summary": "", "edits": [{ "section": "", "current": "", "suggested": "", "why": "" }], "add_keywords": [""], "gaps": [""], "cover_letter": "" }\n\n3 עד 6 עריכות.`,
    SYSTEM
  );
  return {
    headline: out.headline ?? '', summary: out.summary ?? '',
    edits: (out.edits ?? []).slice(0, 8), add_keywords: dedupe(out.add_keywords ?? []),
    gaps: out.gaps ?? [], cover_letter: out.cover_letter ?? '',
  };
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) { const k = s.trim().toLowerCase(); if (k && !seen.has(k)) { seen.add(k); out.push(s.trim()); } }
  return out;
}
