import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Next מחליף את fetch הגלובלי ושומר תשובות במטמון משלו. supabase-js משתמש
 * ב-fetch הזה, ולכן שאילתות חוזרות על אותה כתובת הוחזרו מהמטמון במקום מהמסד.
 *
 * ככה המונה "עוברות את הסף" הציג 72 בזמן שבמסד כבר היו 80: שאילתת הספירה
 * נשלחת כ-HEAD על כתובת קבועה, ולכן היא נתפסה במטמון, בעוד שאילתת הרשימה
 * חזרה טרייה. `force-dynamic` לא מכסה את זה.
 *
 * כאן כל קריאה למסד מסומנת no-store במפורש. אסור להסיר את זה.
 */
export const db = createClient(
  url ?? 'https://placeholder.supabase.co',
  key ?? 'placeholder',
  {
    auth: { persistSession: false },
    global: {
      fetch: (input: any, init?: any) => fetch(input, { ...init, cache: 'no-store' }),
    },
  }
);

export type Resume = {
  id: string; label: string; filename: string | null; content: string;
  is_primary: boolean; quality_score: number | null;
  quality_notes: { strengths: string[]; improvements: string[] } | null;
  created_at: string;
};

export type Job = {
  id: string; external_id: string; url: string; title: string;
  company: string | null; location: string | null; scope: string | null; experience: string | null;
  description: string | null; requirements: string | null; logo_url: string | null;
  posted_at: string | null; first_seen_at: string; last_seen_at: string; repost_dates: string[];
  score: number | null; ats_score: number | null; hr_score: number | null; rating: string | null;
  summary: string | null; responsibilities: string[]; key_requirements: string[]; buzzwords: string[];
  score_reasons: { strengths: string[]; gaps: string[] } | null;
  status: 'new' | 'saved' | 'applied' | 'hidden'; saved_at: string | null; notified: boolean;
  source: 'drushim' | 'linkedin' | 'manual'; recruiter: string | null;
  applied_at: string | null; followed_up_at: string | null;
};

/** ספירה מדויקת בצד השרת, לא חישוב על מערך חלקי בזיכרון */
export async function jobCount(filter?: (q: any) => any): Promise<number> {
  let q: any = db.from('jobs').select('*', { count: 'exact', head: true });
  if (filter) q = filter(q);
  const { count } = await q;
  return count ?? 0;
}

export async function primaryResume(): Promise<Resume | null> {
  const { data } = await db.from('resumes').select('*').eq('is_primary', true).maybeSingle();
  if (data) return data as Resume;
  const { data: first } = await db.from('resumes').select('*').order('created_at').limit(1).maybeSingle();
  return (first as Resume) ?? null;
}
