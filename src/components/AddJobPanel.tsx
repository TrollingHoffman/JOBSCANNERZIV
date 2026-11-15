'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from './Toast';

/**
 * הוספת משרה מלינקדאין: כתובת, או טקסט מודבק של פוסט או התראת מייל.
 * הטקסט המודבק הוא הדרך היחידה שעובדת למשרות שמתפרסמות בפוסט ואין להן עמוד משרה.
 */
export function AddJobPanel() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [showText, setShowText] = useState(false);
  const [busy, setBusy] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const firstField = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { notify } = useToast();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    firstField.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  async function submit() {
    if (!url.trim() && !text.trim()) {
      notify('error', 'אין מה לשלוח', 'צריך כתובת משרה או טקסט מודבק.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), text: text.trim() }),
      });
      const j = await res.json();

      if (!res.ok) {
        if (j.needsText) {
          setShowText(true);
          notify('error', 'העמוד לא נקרא אוטומטית', j.hint ?? j.error);
        } else {
          notify('error', 'ההוספה נכשלה', j.error);
        }
        return;
      }

      if (j.duplicate) {
        notify('info', 'המשרה הזו כבר במאגר', j.title);
      } else if (j.needsResume) {
        notify('success', 'המשרה נוספה', 'בלי קורות חיים ראשיים אין לה ציון התאמה.');
      } else if (j.analyzed) {
        notify('success', `המשרה נוספה עם ציון ${j.score}`, j.title);
      } else {
        notify('success', 'המשרה נוספה', 'הניתוח ירוץ בהרצת הניתוח הבאה.');
      }

      setUrl(''); setText(''); setShowText(false); setOpen(false);
      router.refresh();
    } catch (e: any) {
      notify('error', 'ההוספה נכשלה', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl border border-line px-3.5 py-2 text-sm font-bold text-body transition hover:border-ink hover:text-ink"
      >
        הוספת משרה
      </button>
    );
  }

  return (
    <div
      className="overlay fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-night/55 p-4 backdrop-blur-sm sm:p-8"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="הוספת משרה"
    >
      <div
        ref={panel}
        className="sheet my-auto w-full max-w-lg rounded-3xl border border-line bg-surface p-6 shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl font-bold text-ink">הוספת משרה מלינקדאין</h2>
        <p className="mt-2 text-sm leading-relaxed text-body">
          אפשר להדביק כתובת של משרה, או את הטקסט שלה. המשרה תנותח ותדורג מול קורות החיים
          בדיוק כמו משרה מדרושים.
        </p>

        <label htmlFor="add-url" className="mt-5 block text-sm font-bold text-ink">כתובת המשרה</label>
        <input
          ref={firstField}
          id="add-url"
          type="url"
          dir="ltr"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.linkedin.com/jobs/view/..."
          className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink placeholder:text-muted"
        />

        {!showText ? (
          <button
            onClick={() => setShowText(true)}
            className="mt-3 text-sm font-bold text-accent-ink underline"
          >
            המשרה בפוסט, או בלי עמוד משרה? להדביק טקסט
          </button>
        ) : (
          <>
            <label htmlFor="add-text" className="mt-4 block text-sm font-bold text-ink">
              טקסט המשרה
            </label>
            <p className="mt-1 text-xs text-muted">
              אפשר להדביק פוסט מלינקדאין, התראת מייל, או את תוכן עמוד המשרה.
            </p>
            <textarea
              id="add-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder="להדביק כאן את תוכן המשרה..."
              className="mt-1.5 w-full resize-y rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink placeholder:text-muted"
            />
          </>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <button
            onClick={submit}
            disabled={busy}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white transition hover:bg-accent-ink disabled:opacity-60"
          >
            {busy ? 'מנתח את המשרה...' : 'להוסיף ולנתח'}
          </button>
          <button
            onClick={() => setOpen(false)}
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-body transition hover:border-ink hover:text-ink"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
