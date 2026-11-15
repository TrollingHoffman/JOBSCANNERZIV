'use client';

import { useEffect, useRef, useState } from 'react';
import { THRESHOLD, PEAK } from '@/lib/constants';

export { THRESHOLD };

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
  const [display, setDisplay] = useState<number | null>(null);

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

  /**
   * המספר נוחת יחד עם הפס, ולא רץ בזמן משלו.
   * תנועה משנית מתחברת לרגע של התנועה הראשית, אחרת נוצרות שתי הנפשות
   * שבמקרה קורות באותו זמן. אותה משך ואותה עקומה כמו meter-fill.
   */
  useEffect(() => {
    if (!shown || score === null || score === undefined) return;
    const target = Math.max(0, Math.min(100, score));
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(target);
      return;
    }
    const DUR = 900, DELAY = 100;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start - DELAY) / DUR));
      // cubic-bezier(0.23, 1, 0.32, 1) מקורב, כדי שהספירה והפס יאטו יחד
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shown, score]);

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
  const peak = clamped >= PEAK;
  const h = size === 'lg' ? 'h-2.5' : size === 'sm' ? 'h-1' : 'h-1.5';
  const num = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div ref={ref} className={shown ? 'meter-animate' : ''}>
      <div className="flex items-center gap-2.5">
        <div className={`relative flex-1 overflow-hidden rounded-full bg-line ${h}`}>
          <div
            className={`meter-bar h-full w-full rounded-full ${peak ? 'bg-peak' : strong ? 'bg-good' : 'bg-weak'}`}
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
          <span
            className={`shrink-0 font-display font-bold leading-none tabular-nums ${num} ${peak ? 'text-peak' : strong ? 'text-good' : 'text-muted'}`}
            aria-label={`ציון התאמה ${clamped} מתוך 100`}
          >
            {display ?? clamped}
          </span>
        )}
      </div>
      <p className={`mt-1 font-semibold ${size === 'lg' ? 'text-sm' : 'text-[11px]'} ${peak ? 'text-peak' : strong ? 'text-good' : 'text-muted'}`}>
        {peak
          ? `התאמה מצוינת, ${clamped - THRESHOLD} נקודות מעל הסף`
          : strong
            ? `עובר את הסף ב-${clamped - THRESHOLD} נקודות`
            : `חסרות ${THRESHOLD - clamped} נקודות לסף`}
      </p>
    </div>
  );
}
