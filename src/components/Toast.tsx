'use client';

import { createContext, useCallback, useContext, useState } from 'react';

type Kind = 'success' | 'error' | 'info';
type Item = { id: number; kind: Kind; title: string; detail?: string; leaving?: boolean };

const Ctx = createContext<{ notify: (kind: Kind, title: string, detail?: string) => void }>({ notify: () => {} });
export const useToast = () => useContext(Ctx);
let seq = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);

  const remove = useCallback((id: number) => {
    setItems((cur) => cur.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), 240);
  }, []);

  const notify = useCallback((kind: Kind, title: string, detail?: string) => {
    const id = ++seq;
    setItems((cur) => [...cur.slice(-3), { id, kind, title, detail }]);
    setTimeout(() => remove(id), kind === 'error' ? 10000 : 5000);
  }, [remove]);

  return (
    <Ctx.Provider value={{ notify }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`${t.leaving ? 'toast-out' : 'toast-in'} pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border p-4 shadow-toast ${t.kind === 'success' ? 'border-accent/25 bg-accent-soft' : t.kind === 'error' ? 'border-danger/25 bg-danger-soft' : 'border-line bg-surface'}`}>
            <Icon kind={t.kind} />
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-bold ${t.kind === 'error' ? 'text-danger' : 'text-ink'}`}>{t.title}</p>
              {t.detail && <p className="mt-0.5 text-xs leading-relaxed text-body">{t.detail}</p>}
            </div>
            <button onClick={() => remove(t.id)} aria-label="סגירה" className="shrink-0 text-muted transition hover:text-ink">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

function Icon({ kind }: { kind: Kind }) {
  const cls = kind === 'success' ? 'text-accent' : kind === 'error' ? 'text-danger' : 'text-muted';
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={`shrink-0 ${cls}`} aria-hidden="true">
      <circle cx="10" cy="10" r="8.2" stroke="currentColor" strokeWidth="1.6" />
      {kind === 'success'
        ? <path d="M6.4 10.3l2.4 2.4 4.8-5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        : <path d="M10 5.8v5.2M10 13.8v.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />}
    </svg>
  );
}
