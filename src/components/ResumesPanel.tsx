'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from './Toast';
import type { Resume } from '@/lib/supabase';

/**
 * סלוטים לקורות חיים.
 * סלוט ראשי אחד וסלוטים משניים. גוררים קובץ מהמחשב לסלוט,
 * או גוררים סלוט משני על הראשי כדי להחליף ביניהם.
 * אפשר לרוקן את הסלוט הראשי ולהישאר בלי קורות חיים כלל.
 */
export function ResumesPanel({ resumes }: { resumes: Resume[] }) {
  const router = useRouter();
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const primaryInput = useRef<HTMLInputElement>(null);
  const extraInput = useRef<HTMLInputElement>(null);

  const primary = resumes.find((r) => r.is_primary) ?? null;
  const others = resumes.filter((r) => !r.is_primary);

  async function upload(file: File, opts: { replaceId?: string; asPrimary?: boolean } = {}) {
    if (!/\.(pdf|docx|txt|md)$/i.test(file.name)) {
      notify('error', 'פורמט לא נתמך', 'אפשר PDF, DOCX או TXT');
      return;
    }
    setBusy(true);
    notify('info', opts.replaceId ? 'מחליף את הקובץ…' : 'קורא את הקובץ…', file.name);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (opts.replaceId) fd.append('replaceId', opts.replaceId);
      if (opts.asPrimary) fd.append('asPrimary', '1');
      const res = await fetch('/api/resumes', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'ההעלאה נכשלה');
      notify('success', opts.replaceId ? 'הקובץ הוחלף' : 'קורות החיים הועלו', json.message);
      if (json.warning) notify('error', 'ציון האיכות לא חושב', json.warning);
      router.refresh();
    } catch (e: any) {
      notify('error', 'ההעלאה נכשלה', e.message);
    } finally {
      setBusy(false);
    }
  }

  async function act(body: any) {
    setBusy(true);
    try {
      const res = await fetch('/api/resumes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'הפעולה נכשלה');
      notify(json.warn ? 'info' : 'success', json.message ?? 'בוצע', json.warn);
      router.refresh();
    } catch (e: any) {
      notify('error', 'הפעולה נכשלה', e.message);
    } finally {
      setBusy(false);
      setDragId(null);
      setOver(null);
    }
  }

  function dropOnPrimary(e: React.DragEvent) {
    e.preventDefault();
    setOver(null);
    const f = e.dataTransfer.files?.[0];
    if (f) { upload(f, { asPrimary: true }); return; }
    if (dragId) act({ action: 'primary', id: dragId });
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
      <div className="bg-night p-6 text-white">
        <h2 className="font-display text-2xl font-bold">קורות החיים של זיו</h2>
        <p className="mt-1 text-sm text-white/60">הסלוט הראשי הוא מה שמולו מחושבים הציונים. גררו קובץ לתוכו, או גררו סלוט משני עליו כדי להחליף.</p>
      </div>

      <div className="space-y-5 p-5">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">סלוט ראשי</p>
          <div
            onDragOver={(e) => { e.preventDefault(); setOver('primary'); }}
            onDragLeave={() => setOver(null)}
            onDrop={dropOnPrimary}
            className={`rounded-3xl border-2 p-5 transition ${over === 'primary' ? 'slot-live' : primary ? 'border-accent bg-accent-soft' : 'border-dashed border-line'}`}
          >
            {primary ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-bold text-ink">{primary.label}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">{primary.filename}</p>
                    <p className="mt-0.5 text-xs text-muted">הועלתה {new Date(primary.created_at).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                  {primary.quality_score !== null && (
                    <div className="text-center">
                      <p className="font-display text-4xl font-bold leading-none text-accent">{primary.quality_score}</p>
                      <p className="text-[11px] text-muted">ציון איכות</p>
                    </div>
                  )}
                </div>

                {primary.quality_notes && (
                  <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                    {!!primary.quality_notes.strengths?.length && <div><p className="mb-1 font-bold text-ink">עובד טוב</p><ul className="space-y-1 text-body">{primary.quality_notes.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
                    {!!primary.quality_notes.improvements?.length && <div><p className="mb-1 font-bold text-ink">שווה לשפר</p><ul className="space-y-1 text-body">{primary.quality_notes.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-bold">
                  <button onClick={() => setViewing(viewing === primary.id ? null : primary.id)} className="text-accent underline">{viewing === primary.id ? 'סגירת הטקסט' : 'צפייה בטקסט'}</button>
                  <button disabled={busy} onClick={() => primaryInput.current?.click()} className="text-accent underline disabled:opacity-40">החלפת קובץ</button>
                  <input ref={primaryInput} type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], { replaceId: primary.id })} />
                  <button disabled={busy} onClick={() => act({ action: 'clear-primary' })} className="text-muted underline disabled:opacity-40">ריקון הסלוט</button>
                  <button disabled={busy} onClick={() => act({ action: 'delete', id: primary.id })} className="text-danger underline disabled:opacity-40">מחיקה</button>
                </div>

                {viewing === primary.id && <pre className="panel-open mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-white p-4 text-xs leading-relaxed text-body">{primary.content}</pre>}
              </>
            ) : (
              <button onClick={() => extraInput.current?.click()} className="flex w-full flex-col items-center gap-2 py-8 text-center">
                <PlusIcon />
                <span className="font-bold text-accent">אין גרסה ראשית</span>
                <span className="text-xs text-muted">גררו לכאן קובץ או סלוט משני. בלי גרסה ראשית לא יחושבו ציונים.</span>
              </button>
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">גרסאות נוספות</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {others.map((r) => (
              <div
                key={r.id}
                draggable
                onDragStart={() => setDragId(r.id)}
                onDragEnd={() => { setDragId(null); setOver(null); }}
                className={`cursor-grab rounded-2xl border border-line bg-paper/50 p-4 active:cursor-grabbing ${dragId === r.id ? 'drag-ghost' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <GripIcon />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink">{r.label}</p>
                      <p className="truncate text-xs text-muted">{r.filename}</p>
                    </div>
                  </div>
                  {r.quality_score !== null && <span className="font-display text-2xl font-bold leading-none text-accent">{r.quality_score}</span>}
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold">
                  <button disabled={busy} onClick={() => act({ action: 'primary', id: r.id })} className="text-accent underline disabled:opacity-40">לסלוט הראשי</button>
                  <button onClick={() => setViewing(viewing === r.id ? null : r.id)} className="text-accent underline">{viewing === r.id ? 'סגירה' : 'צפייה'}</button>
                  <button disabled={busy} onClick={() => act({ action: 'delete', id: r.id })} className="text-danger underline disabled:opacity-40">מחיקה</button>
                </div>
                {viewing === r.id && <pre className="panel-open mt-3 max-h-60 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-white p-3 text-xs leading-relaxed text-body">{r.content}</pre>}
              </div>
            ))}

            <div
              onDragOver={(e) => { e.preventDefault(); if (!dragId) setOver('add'); }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => { e.preventDefault(); setOver(null); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
              onClick={() => extraInput.current?.click()}
              className={`flex min-h-[128px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line p-5 text-center transition hover:border-accent ${over === 'add' ? 'slot-live' : ''}`}
            >
              <input ref={extraInput} type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              <PlusIcon />
              <span className="text-sm font-bold text-accent">הוספת גרסה</span>
              <span className="text-xs text-muted">גרירה או לחיצה</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function GripIcon() {
  return (
    <svg width="12" height="16" viewBox="0 0 12 18" fill="currentColor" className="mt-1 shrink-0 text-muted/60" aria-hidden="true">
      <circle cx="3" cy="4" r="1.4" /><circle cx="9" cy="4" r="1.4" />
      <circle cx="3" cy="9" r="1.4" /><circle cx="9" cy="9" r="1.4" />
      <circle cx="3" cy="14" r="1.4" /><circle cx="9" cy="14" r="1.4" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-accent" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
      <path d="M12 8.2v7.6M8.2 12h7.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}
