'use client';

import { useEffect, useRef, useState } from 'react';

export const THRESHOLD = 65;

/**
 * מד ההתאמה: ה-identity motif של המוצר (DESIGN.md).
 *
 * פס מדידה אחד עם חריץ בסף של זיו, שחוזר בכל קנה מידה: בכרטיס, בפופאפ, ובסיכום.
 * הוא נושא מידע (מרחק מהסף) ולכן אינו קישוט, וזה מה שמעביר אותו ב-R-31.
 *
 * המצב לא מסומן בצבע לבד (R-39): יש מספר, יש מילה, ויש מילוי שעובר את החריץ או לא.
 */
export function MatchMeter({
  score,
  size = 'md',
  showNumber = true,
}: {
  score: number | null;
  size?: 'sm' | 'md' | 'lg';
  showNumber?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) { setShown(true); return; }
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } },
      { rootMargin: '0px 0px -10% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // ציון חסר הוא מצב בפני עצמו, לא אפס (unknown ≠ zero)
  if (score === null || score === undefined) {
    return (
      <div className={`flex items-center gap-2 ${size === 'lg' ? 'text-sm' : 'text-xs'}`}>
        <div className="h-1.5 flex-1 rounded-full bg-line" />
        <span className="shrink-0 font-semibold text-muted">טרם נותחה</span>
      </div>
    );
  }

  const clamped = Math.max(0, Math.min(100, score));
  const strong = clamped >= THRESHOLD;
  const h = size === 'lg' ? 'h-2.5' : size === 'sm' ? 'h-1' : 'h-1.5';
  const num = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div ref={ref} className={shown ? 'meter-animate' : ''}>
      <div className="flex items-center gap-2.5">
        <div className={`relative flex-1 overflow-hidden rounded-full bg-line ${h}`}>
          <div
            className={`meter-bar h-full w-full rounded-full ${strong ? 'bg-good' : 'bg-weak'}`}
            style={{ ['--fill' as string]: clamped / 100 }}
          />
          {/* החריץ: הסף של זיו. הדבר שהופך את הפס למד ולא לבר התקדמות. */}
          <div
            className="absolute top-0 h-full w-0.5 bg-ink/35"
            style={{ right: `${THRESHOLD}%` }}
            aria-hidden="true"
          />
        </div>
        {showNumber && (
          <span className={`shrink-0 font-display font-bold leading-none ${num} ${strong ? 'text-good' : 'text-muted'}`}>
            {clamped}
          </span>
        )}
      </div>
      <p className={`mt-1 font-semibold ${size === 'lg' ? 'text-sm' : 'text-[11px]'} ${strong ? 'text-good' : 'text-muted'}`}>
        {strong ? `עובר את הסף ב-${clamped - THRESHOLD} נקודות` : `חסרות ${THRESHOLD - clamped} נקודות לסף`}
      </p>
    </div>
  );
}
