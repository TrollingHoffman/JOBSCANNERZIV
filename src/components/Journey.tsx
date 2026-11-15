import Link from 'next/link';

/**
 * מסלול ההתקדמות של זיו.
 *
 * לא גיימיפיקציה מודבקת: אלה המספרים האמיתיים שלה, מסודרים כמסלול
 * שרואים בו תנועה. כל שלב הוא קישור לרשימה שמאחוריו, ולכן זה ניווט ולא קישוט.
 *
 * שקיפויות הטקסט נמדדו מול הרקע הכהה ולא נבחרו בעין (R-25):
 * white/50 נותן 5.2:1 ו-white/55 נותן 6.1:1. white/35, שהיה כאן קודם,
 * נותן 3.2:1 ונופל בתקן לטקסט קטן.
 */
export function Journey({
  scanned, passing, loved, applied,
}: { scanned: number; passing: number; loved: number; applied: number }) {
  const steps = [
    { label: 'נסרקו', value: scanned, href: '/' },
    { label: 'עוברות את הסף', value: passing, href: '/?view=strong' },
    { label: 'שאהבת', value: loved, href: '/?view=saved' },
    { label: 'הוגשו', value: applied, href: '/?view=applied' },
  ];

  return (
    <ol className="flex flex-wrap items-stretch gap-2 sm:gap-3">
      {steps.map((s, i) => {
        const reached = s.value > 0;
        return (
          <li key={s.label} className="flex flex-1 items-stretch gap-2 sm:gap-3">
            <Link
              href={s.href}
              className={`group flex-1 rounded-2xl border px-3 py-3 transition sm:px-4 ${
                reached
                  ? 'border-white/15 bg-white/[.07] hover:border-signal/60 hover:bg-white/[.12]'
                  : 'border-white/10 bg-transparent hover:border-white/25'
              }`}
            >
              <p className={`font-display text-2xl font-bold leading-none sm:text-3xl ${reached ? 'text-white' : 'text-white/50'}`}>
                {s.value}
              </p>
              <p className={`mt-1.5 text-[11px] leading-tight sm:text-xs ${reached ? 'text-white/70' : 'text-white/55'}`}>
                {s.label}
              </p>
            </Link>
            {i < steps.length - 1 && (
              <span className="hidden self-center text-white/40 sm:block" aria-hidden="true">‹</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
