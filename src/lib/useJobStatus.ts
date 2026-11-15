'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import type { Job } from '@/lib/supabase';

export type JobStatus = 'new' | 'saved' | 'applied';

/**
 * שינוי מצב משרה. עדכון אופטימיסטי, וחזרה אחורה אם השרת סירב,
 * כדי שהכפתור יגיב מיד ולא יישאר תקוע עד ש-refresh חוזר.
 */
export function useJobStatus(job: Job) {
  const [status, setStatus] = useState<Job['status']>(job.status);
  const [justSaved, setJustSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { notify } = useToast();

  async function set(next: JobStatus) {
    const prev = status;
    setStatus(next);
    setBusy(true);
    if (next === 'saved') {
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 400);
    }

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, status: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setStatus(prev);
        notify('error', 'העדכון נכשל', j.error ?? `שגיאה ${res.status}`);
        return;
      }
      notify(
        'success',
        next === 'saved' ? 'נשמר למשרות שאהבתי' : next === 'applied' ? 'סומן כהוגשה' : 'הסימון בוטל',
        job.title
      );
      router.refresh();
    } catch (e: any) {
      setStatus(prev);
      notify('error', 'העדכון נכשל', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return {
    status,
    saved: status === 'saved',
    applied: status === 'applied',
    justSaved,
    busy,
    set,
  };
}
