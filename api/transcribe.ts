// POST /api/transcribe?lang=hi  (body: audio/wav, 16 kHz mono, <= 30 s per request)
// Proxies to Sarvam Speech-to-Text (Saaras) in code-mixed mode so English words stay English.
// Errors are passed through (402 = credits over, 429 = rate limit) so the phone switches to offline Whisper.
import { json, rateLimited } from './_lib/http.js';

const MAX_BYTES = 5 * 1024 * 1024; // brief: 5 MB cap (Vercel's own body limit is ~4.5 MB)
const MAX_SECONDS = 120;
const LANG: Record<string, string> = { hi: 'hi-IN', en: 'en-IN', mr: 'mr-IN', gu: 'gu-IN', auto: 'unknown' };

export async function POST(req: Request): Promise<Response> {
  const key = process.env.SARVAM_API_KEY?.trim();
  if (!key) return json({ error: 'not_configured' }, 503);
  if (rateLimited(req, 'transcribe', 60)) return json({ error: 'rate_limited' }, 429);
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > MAX_BYTES) return json({ error: 'too_large' }, 413);
  const buf = await req.arrayBuffer();
  if (buf.byteLength > MAX_BYTES || buf.byteLength < 100) return json({ error: 'bad_audio' }, 413);
  // 16-bit mono 16 kHz WAV: 32000 bytes per second
  if ((buf.byteLength - 44) / 32000 > MAX_SECONDS) return json({ error: 'too_long' }, 413);

  const lang = LANG[new URL(req.url).searchParams.get('lang') ?? 'auto'] ?? 'unknown';
  const form = new FormData();
  form.append('file', new Blob([buf], { type: 'audio/wav' }), 'note.wav');
  form.append('model', process.env.SARVAM_MODEL?.trim() || 'saaras:v3');
  form.append('mode', process.env.SARVAM_MODE?.trim() || 'codemix');
  form.append('language_code', lang);

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  const started = Date.now();
  try {
    const r = await fetch('https://api.sarvam.ai/speech-to-text', { method: 'POST', headers: { 'api-subscription-key': key }, body: form, signal: ctl.signal });
    const text = await r.text();
    console.log(JSON.stringify({ route: 'transcribe', status: r.status, ms: Date.now() - started, bytes: buf.byteLength }));
    if (!r.ok) return json({ error: 'upstream', status: r.status }, r.status === 402 || r.status === 429 ? r.status : 502);
    const body = JSON.parse(text);
    return json({ text: body.transcript ?? '', language: body.language_code ?? null, by: 'sarvam' });
  } catch {
    return json({ error: 'timeout' }, 504);
  } finally {
    clearTimeout(timer);
  }
}
