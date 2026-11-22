// Small helpers shared by the /api functions: JSON responses, per-IP rate limit, body size caps.

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

// Best-effort in-memory limiter (per warm function instance). Enough to stop casual abuse of free quotas.
const hits = new Map<string, number[]>();
export function rateLimited(req: Request, bucket: string, max = 30, windowMs = 10 * 60 * 1000): boolean {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return list.length > max;
}

export async function readJson(req: Request, maxBytes = 64 * 1024): Promise<unknown> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > maxBytes) throw new Error('too large');
  const text = await req.text();
  if (text.length > maxBytes) throw new Error('too large');
  return JSON.parse(text);
}
