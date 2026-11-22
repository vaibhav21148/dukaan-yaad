// POST /api/extract  { transcript, parties, today, lang } -> { entries, by } | { fallback: true }
import { neverInvent } from '../shared/guard.js';
import { extractPrompt } from '../shared/prompts.js';
import { EXTRACT_JSON_SCHEMA, EXTRACT_REQUEST, ExtractResultSchema } from '../shared/schema.js';
import { json, rateLimited, readJson } from './_lib/http.js';
import { AllProvidersFailed, generateJson } from './_lib/llm.js';

export async function handleExtract(body: unknown) {
  const input = EXTRACT_REQUEST.parse(body);
  const { data, by } = await generateJson(extractPrompt(input.transcript, input.parties, input.today, input.lang), ExtractResultSchema, EXTRACT_JSON_SCHEMA);
  // The "never invent" rule, enforced in code: values not traceable to the note are removed and asked about.
  const guarded = neverInvent(data, input.transcript, input.lang);
  return { entries: guarded.entries, by, nulled: guarded.nulled.length };
}

export async function POST(req: Request): Promise<Response> {
  if (rateLimited(req, 'extract')) return json({ fallback: true, error: 'rate_limited' }, 429);
  let body: unknown;
  try {
    body = await readJson(req, 64 * 1024);
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  try {
    const out = await handleExtract(body);
    console.log(JSON.stringify({ route: 'extract', by: out.by, entries: out.entries.length, nulled: out.nulled }));
    return json(out);
  } catch (e) {
    if (e instanceof AllProvidersFailed) return json({ fallback: true });
    if ((e as { name?: string })?.name === 'ZodError') return json({ error: 'bad_request' }, 400);
    console.log(JSON.stringify({ route: 'extract', error: String(e).slice(0, 200) }));
    return json({ fallback: true });
  }
}
