import { Resend } from 'resend';
import type { Job } from './supabase';

const FROM = process.env.MAIL_FROM || 'Job Scanner <onboarding@resend.dev>';
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '');

export async function sendDigest(to: string[], jobs: Job[]): Promise<number> {
  const key = process.env.RESEND_API_KEY;
  if (!key || to.length === 0 || jobs.length === 0) return 0;
  const resend = new Resend(key);
  const subject = jobs.length === 1 ? `משרה חדשה: ${jobs[0].title}` : `${jobs.length} משרות חדשות`;
  await resend.emails.send({ from: FROM, to, subject, html: digestHtml(jobs) });
  return jobs.length;
}

function digestHtml(jobs: Job[]): string {
  return `<!doctype html><html dir="rtl" lang="he"><body style="margin:0;padding:24px 12px;background:#F7F4EF;font-family:Arial,sans-serif;color:#17171C">
<div style="max-width:640px;margin:0 auto">
  <div style="background:#1C1917;border-radius:18px;padding:24px">
    <p style="margin:0;color:#F59E0B;font-size:13px;font-weight:700">סורק משרות</p>
    <p style="margin:8px 0 0;color:#fff;font-size:26px;font-weight:800">${jobs.length} משרות חדשות</p>
  </div>
  <div style="height:14px"></div>
  ${jobs.map(jobCard).join('')}
  <p style="margin:28px 0 0;font-size:12px;color:#6B6560;text-align:center">${SITE ? `<a href="${SITE}/settings" style="color:#6B6560">שינוי הגדרות</a>` : ''}</p>
</div></body></html>`;
}

function jobCard(j: Job): string {
  const score = j.score ?? 0;
  const color = score >= 65 ? '#15803D' : score >= 50 ? '#92610E' : '#6B6560';
  const meta = [j.company, j.location, j.scope].filter(Boolean).join(' · ');
  const bullets = (arr: string[], title: string) =>
    arr && arr.length ? `<p style="margin:12px 0 4px;font-size:13px;font-weight:700">${title}</p><ul style="margin:0;padding-inline-start:18px;font-size:14px;line-height:1.7;color:#3A4A44">${arr.slice(0, 4).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  const chips = (j.buzzwords ?? []).slice(0, 8).map((b) => `<span style="display:inline-block;background:#FDEEE3;color:#9A3412;border-radius:999px;padding:3px 10px;font-size:12px;margin:0 0 6px 6px">${esc(b)}</span>`).join('');
  const logo = j.logo_url ? `<img src="${esc(j.logo_url)}" width="40" height="40" style="border-radius:10px;object-fit:contain;background:#fff;border:1px solid #E2E8E5" />` : '';

  return `<div style="background:#fff;border-radius:16px;padding:20px;margin-bottom:14px;border:1px solid #E2E8E5">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="52" style="vertical-align:top">${logo}</td>
    <td style="vertical-align:top"><p style="margin:0;font-size:17px;font-weight:700;line-height:1.4">${esc(j.title)}</p><p style="margin:4px 0 0;font-size:13px;color:#6C7B75">${esc(meta)}</p></td>
    <td width="64" style="vertical-align:top;text-align:left"><div style="border:2px solid ${color};color:${color};border-radius:12px;padding:6px 0;text-align:center;font-weight:700;font-size:18px">${score}</div></td>
  </tr></table>
  ${j.summary ? `<p style="margin:14px 0 0;font-size:14px;line-height:1.7;color:#3A4A44">${esc(j.summary)}</p>` : ''}
  ${bullets(j.responsibilities, 'תחומי אחריות')}
  ${bullets(j.key_requirements, 'דרישות מרכזיות')}
  ${chips ? `<p style="margin:14px 0 0">${chips}</p>` : ''}
  <p style="margin:18px 0 0"><a href="${SITE}" style="display:inline-block;background:#C2410C;color:#fff;text-decoration:none;border-radius:10px;padding:10px 18px;font-size:14px;font-weight:700">התאמת קורות חיים</a> <a href="${esc(j.url)}" style="display:inline-block;color:#9A3412;text-decoration:none;padding:10px 12px;font-size:14px">המשרה בדרושים</a></p>
</div>`;
}

function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}
