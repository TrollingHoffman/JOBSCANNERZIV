const BASE = 'https://generativelanguage.googleapis.com/v1beta';

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY לא מוגדר ב-Vercel');
  return key.trim();
}

export function configuredModel(): string { return (process.env.GEMINI_MODEL || '').trim(); }

let cache: { at: number; models: string[] } | null = null;

export async function listModels(): Promise<{ ok: boolean; models?: string[]; status?: number; error?: string }> {
  try {
    const res = await fetch(`${BASE}/models?key=${encodeURIComponent(apiKey())}&pageSize=200`, {
      cache: 'no-store', signal: AbortSignal.timeout(20000),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, status: res.status, error: text.slice(0, 300) };
    const models: string[] = (JSON.parse(text).models ?? [])
      .filter((m: any) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
      .map((m: any) => String(m.name).replace(/^models\//, ''));
    return { ok: true, models };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e).slice(0, 250) };
  }
}

function usableForText(name: string): boolean {
  if (!/^gemini-/.test(name)) return false;
  return !/(image|tts|audio|video|transcribe|robotics|computer-use|omni|deep-research|antigravity|embedding)/i.test(name);
}

function rank(name: string): number {
  let s = 0;
  if (/flash/.test(name)) s += 40;
  if (/lite/.test(name)) s -= 15;
  if (/preview/.test(name)) s -= 25;
  const v = name.match(/gemini-(\d+(?:\.\d+)?)/);
  if (v) s += Math.min(30, parseFloat(v[1]) * 6);
  if (/latest/.test(name)) s += 12;
  return s;
}

async function candidates(): Promise<string[]> {
  const out: string[] = [];
  const preferred = configuredModel();
  if (preferred) out.push(preferred);
  if (!cache || Date.now() - cache.at > 600000) {
    const listed = await listModels();
    if (listed.ok && listed.models?.length) cache = { at: Date.now(), models: listed.models };
  }
  for (const m of (cache?.models ?? []).filter(usableForText).sort((a, b) => rank(b) - rank(a))) if (!out.includes(m)) out.push(m);
  if (out.length <= 1) out.push('gemini-flash-latest', 'gemini-2.5-flash');
  return out.slice(0, 6);
}

async function callModel(model: string, prompt: string, system?: string): Promise<string> {
  const body: Record<string, any> = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };

  // תקרת זמן לקריאה בודדת. בלעדיה קריאה שנתקעת מבזבזת את כל תקציב
  // הזמן של הפונקציה, ואז אף משרה לא מנותחת.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  let res: Response;
  try {
    res = await fetch(`${BASE}/models/${model}:generateContent?key=${encodeURIComponent(apiKey())}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      cache: 'no-store', signal: ctrl.signal,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error(`${model} לא ענה תוך 45 שניות`);
    throw e;
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 220);
    try { detail = JSON.parse(text)?.error?.message ?? detail; } catch {}
    const err: any = new Error(detail);
    err.status = res.status;
    throw err;
  }
  const out = JSON.parse(text)?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '';
  if (!out) throw new Error('תשובה ריקה');
  return out;
}

export async function askJson<T>(prompt: string, system?: string): Promise<T> {
  const chain = await candidates();
  const attempts: string[] = [];
  let raw = '', ok = false;

  for (const model of chain) {
    try { raw = await callModel(model, prompt, system); ok = true; break; }
    catch (e: any) {
      attempts.push(`${model} → ${e?.status ?? ''} ${String(e?.message ?? e).slice(0, 80)}`);

      // 429 היא מכסה ברמת הפרויקט ולא ברמת המודל: כל המודלים חולקים אותה.
      // מעבר למודל הבא רק ישרוף עוד קריאה מאותה מכסה, פי שישה בכל משרה,
      // ויחמיר בדיוק את מה שניסינו לעקוף. עוצרים מיד.
      if (e?.status === 429) {
        throw new Error('המכסה של Gemini נגמרה. המכסה היומית מתאפסת, והניתוח המתוזמן ימשיך מעצמו כשהיא תתאפס.');
      }
      if (e?.status === 400 || e?.status === 401 || e?.status === 403) break;
    }
  }
  if (!ok) throw new Error(`כל המודלים נכשלו. ${attempts.join(' | ')}`);

  const clean = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(clean) as T; }
  catch {
    const m = clean.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error('Gemini החזיר תשובה שאינה JSON תקין');
  }
}
