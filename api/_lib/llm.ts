// Provider-agnostic LLM layer. Free tiers first: Gemini -> Groq -> (Anthropic, only if configured).
// On 429 / 402 / timeout / invalid JSON / any error, the next provider is tried.
// If every provider fails, callers return { fallback: true } and the phone runs the offline parser.
import type { ZodType } from 'zod';

export type Provider = 'gemini' | 'groq' | 'anthropic';
export interface LlmResult<T> {
  data: T;
  by: Provider;
}
export class AllProvidersFailed extends Error {
  constructor(public errors: string[]) {
    super('all providers failed: ' + errors.join(' | '));
  }
}

const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? 8000);
const env = (k: string) => process.env[k]?.trim() || undefined;

export function configuredProviders(): Provider[] {
  const all: Provider[] = [];
  if (env('GEMINI_API_KEY')) all.push('gemini');
  if (env('GROQ_API_KEY')) all.push('groq');
  if (env('ANTHROPIC_API_KEY') && (env('LLM_PROVIDER') === 'anthropic' || env('LLM_CHAIN_ANTHROPIC') === '1')) all.push('anthropic');
  const first = (env('LLM_PROVIDER') ?? 'gemini') as Provider;
  return [...all.filter((p) => p === first), ...all.filter((p) => p !== first)];
}

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<{ status: number; json: any; text: string }> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ctl.signal });
    const text = await r.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* non-JSON error body */
    }
    return { status: r.status, json, text };
  } finally {
    clearTimeout(t);
  }
}

class HttpError extends Error {
  constructor(public status: number, msg: string) {
    super(msg);
  }
}

/** Raw text from one provider. mode: false = plain text, true = JSON mode, object = JSON with that schema. */
async function callProvider(p: Provider, prompt: string, mode: boolean | object = false): Promise<string> {
  const jsonSchema = typeof mode === 'object' ? mode : undefined;
  const wantJson = mode !== false;
  if (p === 'gemini') {
    const model = env('GEMINI_MODEL') ?? 'gemini-3.1-flash-lite';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const generationConfig: Record<string, unknown> = jsonSchema
      ? { responseMimeType: 'application/json', responseJsonSchema: jsonSchema }
      : wantJson
        ? { responseMimeType: 'application/json' }
        : {};
    const req = (gc: Record<string, unknown>) => post(url, { 'x-goog-api-key': env('GEMINI_API_KEY')! }, { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: gc });
    let r = await req(generationConfig);
    if (r.status === 400 && jsonSchema) r = await req({ responseMimeType: 'application/json' }); // schema feature not accepted by this model
    if (r.status !== 200) throw new HttpError(r.status, `gemini ${r.status} ${r.text.slice(0, 200)}`);
    const parts = r.json?.candidates?.[0]?.content?.parts ?? [];
    return parts.map((x: { text?: string; thought?: boolean }) => (x.thought ? '' : x.text ?? '')).join('');
  }
  if (p === 'groq') {
    const model = env('GROQ_MODEL') ?? 'openai/gpt-oss-20b';
    const base: Record<string, unknown> = { model, messages: [{ role: 'user', content: prompt }], temperature: 0 };
    if (model.startsWith('openai/gpt-oss')) base.reasoning_effort = 'low';
    const headers = { authorization: `Bearer ${env('GROQ_API_KEY')}` };
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    let r = await post(
      url,
      headers,
      jsonSchema ? { ...base, response_format: { type: 'json_schema', json_schema: { name: 'result', schema: jsonSchema, strict: false } } } : wantJson ? { ...base, response_format: { type: 'json_object' } } : base,
    );
    if (r.status === 400 && jsonSchema) r = await post(url, headers, { ...base, response_format: { type: 'json_object' } });
    if (r.status !== 200) throw new HttpError(r.status, `groq ${r.status} ${r.text.slice(0, 200)}`);
    return r.json?.choices?.[0]?.message?.content ?? '';
  }
  // anthropic (optional, off by default)
  const model = env('ANTHROPIC_MODEL') ?? 'claude-haiku-5-5';
  const r = await post(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': env('ANTHROPIC_API_KEY')!, 'anthropic-version': '2023-06-01' },
    { model, max_tokens: 1500, messages: [{ role: 'user', content: wantJson ? `${prompt}\n\nRespond with the JSON object only.` : prompt }] },
  );
  if (r.status !== 200) throw new HttpError(r.status, `anthropic ${r.status} ${r.text.slice(0, 200)}`);
  return (r.json?.content ?? []).map((b: { type: string; text?: string }) => (b.type === 'text' ? b.text : '')).join('');
}

function extractJson(text: string): unknown {
  const a = text.indexOf('{');
  const b = text.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('no JSON object in response');
  return JSON.parse(text.slice(a, b + 1));
}

export async function generateJson<T>(prompt: string, schema: ZodType<T>, jsonSchema?: object): Promise<LlmResult<T>> {
  const errors: string[] = [];
  for (const p of configuredProviders()) {
    const started = Date.now();
    try {
      const raw = await callProvider(p, prompt, jsonSchema ?? true);
      const parsed = schema.safeParse(extractJson(raw));
      if (!parsed.success) throw new Error('schema mismatch');
      console.log(JSON.stringify({ llm: p, ok: true, ms: Date.now() - started }));
      return { data: parsed.data, by: p };
    } catch (e) {
      const msg = e instanceof Error ? (e.name === 'AbortError' ? `${p} timeout` : e.message) : String(e);
      console.log(JSON.stringify({ llm: p, ok: false, ms: Date.now() - started, err: msg.slice(0, 160) }));
      errors.push(msg);
    }
  }
  throw new AllProvidersFailed(errors.length ? errors : ['no provider configured']);
}

export async function generateText(prompt: string): Promise<LlmResult<string>> {
  const errors: string[] = [];
  for (const p of configuredProviders()) {
    try {
      const text = (await callProvider(p, prompt)).trim();
      if (!text) throw new Error('empty');
      return { data: text, by: p };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  throw new AllProvidersFailed(errors);
}
