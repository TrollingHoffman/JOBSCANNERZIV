'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ResumesPanel } from './ResumesPanel';
import { useToast } from './Toast';
import type { Resume } from '@/lib/supabase';

type Search = { id: string; label: string; url: string; max_pages: number; active: boolean };

export function SettingsForm({ settings, searches, resumes }: { settings: any; searches: Search[]; resumes: Resume[] }) {
  const router = useRouter();
  const { notify } = useToast();
  const [emails, setEmails] = useState<string[]>(settings?.notify_emails ?? []);
  const [newEmail, setNewEmail] = useState('');
  const [minScore, setMinScore] = useState<number>(settings?.min_score ?? 55);
  const [sendEmail, setSendEmail] = useState<boolean>(settings?.send_email ?? true);
  const [newSearch, setNewSearch] = useState({ label: '', url: '', maxPages: 5 });

  function addEmail() {
    const e = newEmail.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { notify('error', 'כתובת לא תקינה', e); return; }
    if (emails.includes(e)) { notify('info', 'הכתובת כבר קיימת'); return; }
    setEmails([...emails, e]);
    setNewEmail('');
    notify('info', 'נוסף לרשימה', 'לחצו שמירת שינויים כדי להחיל');
  }

  async function post(body: any, okTitle: string) {
    try {
      const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      notify('success', okTitle, json.message);
      setNewSearch({ label: '', url: '', maxPages: 5 });
      router.refresh();
    } catch (e: any) {
      notify('error', 'הפעולה נכשלה', e.message);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <ResumesPanel resumes={resumes} />

      <Card title="חיפושים" note="כל קישור מדרושים מרחיב את המאגר. הסריקה עוברת על כולם ומאחדת בלי כפילויות.">
        <ul className="space-y-2">
          {searches.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-paper/60 p-3.5 text-sm">
              <div className="min-w-0">
                <p className="font-bold text-ink">{s.label}</p>
                <p className="truncate text-xs text-muted" dir="ltr">{s.url}</p>
                <p className="mt-0.5 text-xs text-muted">{s.max_pages} עמודים · {s.active ? 'פעיל' : 'מושהה'}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-xs font-bold">
                <button onClick={() => post({ action: 'toggle-search', id: s.id, active: !s.active }, 'עודכן')} className="text-accent underline">{s.active ? 'השהייה' : 'הפעלה'}</button>
                <button onClick={() => post({ action: 'remove-search', id: s.id }, 'הוסר')} className="text-danger underline">הסרה</button>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-3 space-y-2 rounded-2xl border-2 border-dashed border-line p-4">
          <Input label="שם החיפוש" value={newSearch.label} onChange={(v) => setNewSearch({ ...newSearch, label: v })} placeholder="שיווק דיגיטלי, מרכז" />
          <Input label="קישור מדרושים" value={newSearch.url} onChange={(v) => setNewSearch({ ...newSearch, url: v })} placeholder="https://www.drushim.co.il/jobs/search/..." ltr />
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-ink">עומק סריקה: {newSearch.maxPages} עמודים</span>
            <input type="range" min={1} max={10} value={newSearch.maxPages} onChange={(e) => setNewSearch({ ...newSearch, maxPages: Number(e.target.value) })} className="w-full accent-[#2F6B58]" />
          </label>
          <button onClick={() => post({ action: 'add-search', ...newSearch }, 'החיפוש נוסף')} disabled={!newSearch.url} className="rounded-xl bg-night px-5 py-2.5 text-sm font-bold text-white transition hover:bg-accent disabled:opacity-40">הוספת חיפוש</button>
        </div>
      </Card>

      <Card title="מיילים" note="כל הנמענים מקבלים את אותו עדכון.">
        <div className="mb-3 flex flex-wrap gap-2">
          {emails.map((e) => (
            <span key={e} className="flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-3 py-1.5 text-sm text-accent" dir="ltr">
              <span>{e}</span>
              <button onClick={() => setEmails(emails.filter((x) => x !== e))} aria-label={`הסרת ${e}`} className="font-bold leading-none">×</button>
            </span>
          ))}
          {emails.length === 0 && <span className="text-sm text-muted">עדיין לא הוגדרו נמענים</span>}
        </div>
        <div className="flex gap-2">
          <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addEmail()} placeholder="ziv@example.com" dir="ltr" className="flex-1 rounded-xl border border-line bg-paper/50 px-3.5 py-2.5 text-sm" />
          <button onClick={addEmail} className="rounded-xl bg-night px-4 py-2.5 text-sm font-bold text-white transition hover:bg-accent">הוספה</button>
        </div>
        <label className="mt-4 flex items-center gap-2.5 text-sm">
          <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="h-4 w-4 accent-[#2F6B58]" />
          שליחת מייל כשנמצאות משרות חדשות
        </label>
        <div className="mt-4">
          <label className="text-sm font-bold text-ink">ציון מינימלי לשליחה: <span className="text-accent">{minScore}</span></label>
          <input type="range" min={0} max={100} step={5} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="mt-2 w-full accent-[#2F6B58]" />
        </div>
      </Card>

      <div className="sticky bottom-4 rounded-2xl border border-line bg-surface/95 p-4 shadow-lift backdrop-blur">
        <button onClick={() => post({ emails, minScore, sendEmail }, 'ההגדרות נשמרו')} className="rounded-xl bg-night px-6 py-2.5 text-sm font-bold text-white transition hover:bg-accent">שמירת שינויים</button>
      </div>
    </div>
  );
}

function Card({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-6">
      <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
      <p className="mb-4 mt-1 text-sm text-muted">{note}</p>
      {children}
    </section>
  );
}

function Input({ label, value, onChange, placeholder, ltr }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; ltr?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-ink">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} dir={ltr ? 'ltr' : 'rtl'} className="w-full rounded-xl border border-line bg-paper/50 px-3.5 py-2.5 text-sm text-ink transition focus:border-accent focus:bg-white" />
    </label>
  );
}
