import Link from 'next/link';
import { db } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const { data: runs } = await db.from('scan_runs').select('*').not('finished_at', 'is', null).order('started_at', { ascending: false }).limit(40);
  const list = runs ?? [];
  const totals = list.reduce((a: any, r: any) => ({
    found: a.found + (r.found ?? 0), newJobs: a.newJobs + (r.new_jobs ?? 0),
    emailed: a.emailed + (r.emailed ?? 0), failed: a.failed + (r.error ? 1 : 0),
  }), { found: 0, newJobs: 0, emailed: 0, failed: 0 });

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/" className="text-sm font-bold text-accent hover:underline">→ חזרה למשרות</Link>
      <h1 className="mt-4 font-display text-4xl font-bold text-ink">דוח סריקות</h1>
      <p className="mt-1 text-sm text-muted">הסריקה רצה כל שעה עגולה בין 08:00 ל-22:00 שעון ישראל.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi value={totals.found} label="נסרקו סהכ" />
        <Kpi value={totals.newJobs} label="משרות חדשות" />
        <Kpi value={totals.emailed} label="נשלחו במייל" />
        <Kpi value={totals.failed} label="סריקות עם שגיאה" tone={totals.failed ? 'danger' : 'ok'} />
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-paper text-right text-xs text-muted">
            <tr><th className="p-3 font-bold">מתי</th><th className="p-3 font-bold">משך</th><th className="p-3 font-bold">נמצאו</th><th className="p-3 font-bold">חדשות</th><th className="p-3 font-bold">חוזר</th><th className="p-3 font-bold">מייל</th><th className="p-3 font-bold">מצב</th></tr>
          </thead>
          <tbody>
            {list.map((r: any) => {
              const sec = Math.round((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000);
              return (
                <tr key={r.id} className="border-t border-line">
                  <td className="p-3 text-body">{new Date(r.started_at).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="p-3 text-muted">{sec} שנ׳</td>
                  <td className="p-3 text-body">{r.found}</td>
                  <td className={`p-3 font-bold ${r.new_jobs ? 'text-accent' : 'text-muted'}`}>{r.new_jobs}</td>
                  <td className="p-3 text-body">{r.reposts}</td>
                  <td className="p-3 text-body">{r.emailed}</td>
                  <td className="p-3">{r.error ? <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-bold text-danger">שגיאה</span> : <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent">תקין</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 && <p className="p-8 text-center text-sm text-muted">עדיין אין סריקות</p>}
      </div>

      {list.some((r: any) => r.error) && (
        <div className="mt-6 rounded-3xl border border-danger/25 bg-danger-soft p-5">
          <h2 className="mb-2 font-display text-lg font-bold text-danger">שגיאות אחרונות</h2>
          <ul className="space-y-1 text-sm text-body">
            {list.filter((r: any) => r.error).slice(0, 5).map((r: any) => (
              <li key={r.id}><span className="font-bold">{new Date(r.started_at).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span> — {r.error}</li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}

function Kpi({ value, label, tone = 'ok' }: { value: number; label: string; tone?: 'ok' | 'danger' }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <p className={`font-display text-3xl font-bold leading-none ${tone === 'danger' ? 'text-danger' : 'text-accent'}`}>{value}</p>
      <p className="mt-1.5 text-xs text-muted">{label}</p>
    </div>
  );
}
