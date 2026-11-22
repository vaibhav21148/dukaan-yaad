// Runs Poochho questions against a saved-ledger fixture: local answerer always, online per provider when keys exist.
// An answer passes when it contains every expected fact and none of the forbidden ones
// (online answers also go through the same grounding check the app uses).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROMPT_VERSION } from '../shared/prompts';
import type { Lang, LedgerSnapshot } from '../shared/types';
import { handleAsk } from '../api/ask';
import { configuredProviders } from '../api/_lib/llm';
import { answerIsGrounded } from '../src/ask';
import { answerLocal } from '../src/ask/local';
import { args, cacheGet, cachePut, EVALS, readJsonl, sleep } from './lib';

interface AskCase {
  id: string;
  lang: Lang;
  ledger_fixture: string;
  question: string;
  expected_answer_facts: string[];
  forbidden_facts?: string[];
  example?: boolean;
}

const norm = (s: string) => s.toLowerCase().replace(/(\d),(?=\d)/g, '$1');

export async function runAsk(): Promise<{ md: string }> {
  const a = args();
  const cases = readJsonl<AskCase>(join(EVALS, 'cases/ask.jsonl')).filter((c) => !a.only || c.id === a.only);
  const available = configuredProviders();
  const paths = a.provider === 'all' ? ['local', ...available] : a.provider === 'offline' ? ['local'] : [a.provider];
  const rows: { id: string; path: string; ok: boolean; answer: string; why: string }[] = [];
  for (const path of paths) {
    if (path !== 'local' && path !== 'online' && !available.includes(path as never)) continue;
    for (const c of cases) {
      const ledger = JSON.parse(readFileSync(join(EVALS, 'fixtures', `${c.ledger_fixture}.json`), 'utf8')) as LedgerSnapshot;
      let answer = '';
      if (path === 'local') answer = answerLocal(c.question, ledger, c.lang);
      else {
        const key = `ask|${path}|${PROMPT_VERSION}|${c.id}|${c.question}|${c.ledger_fixture}`;
        let res = a.noCache ? null : cacheGet<{ answer: string }>(key);
        if (!res) {
          const saved = { ...process.env };
          if (path !== 'online') for (const k of ['GEMINI_API_KEY', 'GROQ_API_KEY', 'ANTHROPIC_API_KEY']) if (!k.toLowerCase().startsWith(path)) delete process.env[k];
          try {
            res = await handleAsk({ question: c.question, ledger, lang: c.lang });
            cachePut(key, res);
          } catch (e) {
            res = { answer: `ERROR ${String((e as Error).message).slice(0, 100)}` };
          } finally {
            Object.assign(process.env, saved);
          }
          await sleep(a.delay);
        }
        // the app replaces an ungrounded AI answer with the local one; score what the owner would see
        answer = answerIsGrounded(res.answer, ledger) ? res.answer : answerLocal(c.question, ledger, c.lang) + ' [AI answer rejected: ungrounded number]';
      }
      const missing = c.expected_answer_facts.filter((f) => !norm(answer).includes(norm(f)));
      const forbidden = (c.forbidden_facts ?? []).filter((f) => norm(answer).includes(norm(f)));
      rows.push({ id: c.id, path, ok: !missing.length && !forbidden.length, answer, why: [missing.length && `missing ${missing.join(', ')}`, forbidden.length && `contains ${forbidden.join(', ')}`].filter(Boolean).join('; ') });
    }
  }
  const byPath = new Map<string, typeof rows>();
  for (const r of rows) byPath.set(r.path, [...(byPath.get(r.path) ?? []), r]);
  const exampleOnly = cases.length > 0 && cases.every((c) => c.example);
  const md = [
    '## Ask (Poochho)',
    exampleOnly ? '> **Only example cases are present.**\n' : '> Test set written during development, run against the saved-ledger fixture.\n',
    '| Path | Cases | Answers match saved data (target 100%) |',
    '|---|---|---|',
    ...[...byPath.entries()].map(([p, l]) => `| ${p} | ${l.length} | ${Math.round((l.filter((r) => r.ok).length / l.length) * 100)}% |`),
    '',
    '<details><summary>Answers</summary>\n',
    ...rows.map((r) => `- ${r.ok ? '✅' : '❌'} \`${r.id}\` (${r.path}): ${r.answer.replace(/\n/g, ' / ')}${r.why ? ` — ${r.why}` : ''}`),
    '\n</details>',
  ].join('\n');
  return { md };
}

if (import.meta.url === `file://${process.argv[1]}`) runAsk().then(({ md }) => console.log(md));
