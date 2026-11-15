import Link from 'next/link';
import { db, type Resume } from '@/lib/supabase';
import { SettingsForm } from '@/components/SettingsForm';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { data: settings } = await db.from('settings').select('*').eq('id', 1).single();
  const { data: searches } = await db.from('searches').select('*').order('created_at');
  const { data: resumes } = await db.from('resumes').select('*').order('created_at');

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/" className="text-sm font-bold text-accent hover:underline">→ חזרה למשרות</Link>
      <h1 className="mt-4 font-display text-4xl font-bold text-ink">הגדרות</h1>
      <SettingsForm settings={settings} searches={(searches ?? []) as any} resumes={(resumes ?? []) as Resume[]} />
    </main>
  );
}
