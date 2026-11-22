// Client-side extraction: cache -> online (/api/extract) -> offline parser. Never fails.
import { PROMPT_VERSION } from '../../shared/prompts';
import { ExtractResultSchema } from '../../shared/schema';
import type { ExtractBy, ExtractedEntry, Lang } from '../../shared/types';
import { db } from '../db/db';
import { fetchWithTimeout, sha256 } from '../lib/hash';
import { parseOffline, type KnownParty } from './offline/parser';

export interface UnderstandResult {
  entries: ExtractedEntry[];
  by: ExtractBy;
  offline: boolean;
  reason?: 'no-network' | 'ai-failed' | 'ai-off';
}

const DAY = 24 * 3600 * 1000;
let onlineDisabledUntil = 0; // back off after quota errors

export async function understand(
  text: string,
  opts: { lang: Lang; today: string; parties: KnownParty[]; online: boolean },
): Promise<UnderstandResult> {
  const offline = (reason: UnderstandResult['reason']): UnderstandResult => ({
    entries: parseOffline(text, { today: opts.today, lang: opts.lang, parties: opts.parties }),
    by: 'offline',
    offline: true,
    reason,
  });
  if (!opts.online) return offline('ai-off');
  if (typeof navigator !== 'undefined' && !navigator.onLine) return offline('no-network');
  if (Date.now() < onlineDisabledUntil) return offline('ai-failed');

  const names = [...new Set(opts.parties.flatMap((p) => [p.name, ...p.aliases]))].slice(0, 120);
  const hash = await sha256([PROMPT_VERSION, opts.lang, opts.today, text, names.join('|')].join('\u0001'));
  const hit = await db.cache.get(hash).catch(() => undefined);
  if (hit && Date.now() - hit.at < DAY) {
    const r = hit.result as { entries: ExtractedEntry[]; by: ExtractBy };
    return { entries: r.entries, by: r.by, offline: false };
  }
  try {
    const res = await fetchWithTimeout(
      '/api/extract',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ transcript: text, parties: names, today: opts.today, lang: opts.lang }) },
      15000,
    );
    if (res.status === 429) onlineDisabledUntil = Date.now() + 5 * 60 * 1000;
    if (!res.ok) return offline('ai-failed');
    const body = await res.json();
    if (body.fallback) {
      onlineDisabledUntil = Date.now() + 2 * 60 * 1000;
      return offline('ai-failed');
    }
    const entries = ExtractResultSchema.parse({ entries: body.entries });
    const by = (['gemini', 'groq', 'anthropic'].includes(body.by) ? body.by : 'gemini') as ExtractBy;
    await db.cache.put({ hash, result: { entries, by }, at: Date.now() }).catch(() => undefined);
    return { entries, by, offline: false };
  } catch {
    return offline('ai-failed');
  }
}

/** Remove cache rows older than a day. */
export async function pruneCache(): Promise<void> {
  await db.cache.where('at').below(Date.now() - DAY).delete().catch(() => undefined);
}
