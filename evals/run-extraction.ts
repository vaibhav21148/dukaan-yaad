// Runs the offline parser AND the online extractor (per provider) on every case in cases/extraction.jsonl.
// Usage: npm run eval:extraction -- --provider all --delay 4000
//   --provider offline | gemini | groq | anthropic | online | all
import { join } from 'node:path';
import { PROMPT_VERSION } from '../shared/prompts';
import type { DraftEntry, ExtractedEntry, Party } from '../shared/types';
import { handleExtract } from '../api/extract';
import { configuredProviders } from '../api/_lib/llm';
import { toDrafts } from '../src/domain/drafts';
import { parseOffline } from '../src/extract/offline/parser';
import { args, cacheGet, cachePut, EVALS, extractionTable, failuresList, readJsonl, scoreExtraction, sleep, type ExtractionCase, type ExtractionScore } from './lib';

function partiesOf(c: ExtractionCase): Party[] {
  return (c.parties ?? []).map((name, i) => ({ id: `p${i}`, name, aliases: [], createdAt: '' }));
}

/** Same post-processing the app does: guard + party matching -> review cards. */
function asCards(c: ExtractionCase, entries: ExtractedEntry[]): DraftEntry[] {
  return toDrafts(entries, c.transcript, partiesOf(c), c.lang);
}

export async function runExtraction(): Promise<{ md: string; scores: ExtractionScore[] }> {
  const a = args();
  const cases = readJsonl<ExtractionCase>(join(EVALS, 'cases/extraction.jsonl')).filter((c) => !a.only || c.id === a.only);
  const available = configuredProviders();
  const wanted = a.provider === 'all' ? ['offline', ...available] : a.provider === 'online' ? ['online'] : [a.provider];
  const scores: ExtractionScore[] = [];
  const skipped: string[] = [];

  for (const path of wanted) {
    if (path !== 'offline' && path !== 'online' && !available.includes(path as never)) {
      skipped.push(`${path} (no API key in env)`);
      continue;
    }
    if (path === 'online' && !available.length) {
      skipped.push('online (no API keys in env)');
      continue;
    }
    for (const c of cases) {
      const today = c.today ?? '2026-11-22';
      if (path === 'offline') {
        const raw = parseOffline(c.transcript, { today, lang: c.lang, parties: (c.parties ?? []).map((n) => ({ name: n, aliases: [], side: null })) });
        scores.push(scoreExtraction(c, 'offline', asCards(c, raw)));
        continue;
      }
      const key = `extract|${path}|${PROMPT_VERSION}|${c.id}|${c.transcript}|${today}|${(c.parties ?? []).join(',')}`;
      let res = a.noCache ? null : cacheGet<{ entries: ExtractedEntry[]; nulled: number; by: string } | { error: string }>(key);
      if (!res) {
        const prev = process.env.LLM_PROVIDER;
        if (path !== 'online') process.env.LLM_PROVIDER = path;
        try {
          // force a single provider so quality is reported per provider (no silent fallback to another)
          const only = path === 'online' ? undefined : path;
          const saved = { ...process.env };
          if (only) for (const k of ['GEMINI_API_KEY', 'GROQ_API_KEY', 'ANTHROPIC_API_KEY']) if (!k.toLowerCase().startsWith(only)) delete process.env[k];
          try {
            res = await handleExtract({ transcript: c.transcript, parties: c.parties ?? [], today, lang: c.lang });
          } finally {
            Object.assign(process.env, saved);
          }
          cachePut(key, res);
        } catch (e) {
          res = { error: String((e as Error).message ?? e).slice(0, 160) };
        } finally {
          process.env.LLM_PROVIDER = prev;
        }
        await sleep(a.delay);
      }
      if ('error' in res) {
        scores.push({ ...scoreExtraction(c, path, []), error: res.error });
        continue;
      }
      scores.push(scoreExtraction(c, path === 'online' ? `online:${res.by}` : path, asCards(c, res.entries), res.nulled));
    }
  }

  const exampleOnly = cases.length > 0 && cases.every((c) => (c as { example?: boolean }).example);
  const md = [
    '## Extraction',
    exampleOnly ? '> **Only example cases are present.**\n' : '> Test set written during development (not yet collected from shop owners); every case is scored as the owner would see it.\n',
    `Cases: ${cases.length}. Paths run: ${wanted.filter((w) => !skipped.some((s) => s.startsWith(w))).join(', ') || 'none'}.${skipped.length ? ` Skipped: ${skipped.join(', ')}.` : ''}`,
    '',
    '### By path',
    extractionTable(scores, (s) => [s.path]),
    '',
    '### By path and language',
    extractionTable(scores, (s) => [`${s.path} · ${s.lang}`]),
    '',
    '### By path and category',
    extractionTable(scores, (s) => s.tags.filter((t) => !t.startsWith('lang:')).map((t) => `${s.path} · ${t}`)),
    '',
    '### Failing cases',
    failuresList(scores),
    '',
    '_"Invented values" counts values in the final cards (after the never-invent guard) that are not in the note. "Caught by guard" counts values the model produced that the guard removed before the owner saw them._',
  ].join('\n');
  return { md, scores };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runExtraction().then(({ md }) => console.log(md));
}
