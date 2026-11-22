// POST /api/ask  { question, ledger, lang } -> { answer, by } | { fallback: true }
import { askPrompt } from '../shared/prompts.js';
import { ASK_REQUEST, AskResultSchema } from '../shared/schema.js';
import type { LedgerSnapshot } from '../shared/types.js';
import { json, rateLimited, readJson } from './_lib/http.js';
import { AllProvidersFailed, generateJson } from './_lib/llm.js';

const ASK_JSON_SCHEMA = { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'], additionalProperties: false };

export async function handleAsk(body: unknown) {
  const input = ASK_REQUEST.parse(body);
  const { data, by } = await generateJson(askPrompt(input.question, input.ledger as LedgerSnapshot, input.lang), AskResultSchema, ASK_JSON_SCHEMA);
  return { answer: data.answer, by };
}

export async function POST(req: Request): Promise<Response> {
  if (rateLimited(req, 'ask')) return json({ fallback: true, error: 'rate_limited' }, 429);
  let body: unknown;
  try {
    body = await readJson(req, 200 * 1024);
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  try {
    const out = await handleAsk(body);
    console.log(JSON.stringify({ route: 'ask', by: out.by }));
    return json(out);
  } catch (e) {
    if (e instanceof AllProvidersFailed) return json({ fallback: true });
    if ((e as { name?: string })?.name === 'ZodError') return json({ error: 'bad_request' }, 400);
    return json({ fallback: true });
  }
}
