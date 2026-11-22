// Shared helpers for the eval runners: case loading, caching, scoring, markdown.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasDateWord } from '../shared/dates';
import { nameInText, nameKey } from '../shared/names';
import { numbersIn } from '../shared/numbers';
import type { DraftEntry, ExtractedEntry, Lang } from '../shared/types';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const EVALS = join(ROOT, 'evals');
const CACHE = join(EVALS, '.cache');

export function args() {
  const a = process.argv.slice(2);
  const get = (k: string, d: string) => {
    const i = a.indexOf(`--${k}`);
    return i >= 0 && a[i + 1] ? a[i + 1] : d;
  };
  return {
    provider: get('provider', 'offline'), // offline | gemini | groq | anthropic | online (default chain) | all
    delay: Number(get('delay', '4000')), // ms between online calls, to go easy on free quotas
    only: get('only', ''), // run one case id
    noCache: a.includes('--no-cache'),
  };
}

export function readJsonl<T>(file: string): T[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//'))
    .map((l) => JSON.parse(l) as T);
}

export function cacheGet<T>(key: string): T | null {
  const f = join(CACHE, createHash('sha256').update(key).digest('hex').slice(0, 32) + '.json');
  return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as T) : null;
}
export function cachePut(key: string, v: unknown) {
  mkdirSync(CACHE, { recursive: true });
  const f = join(CACHE, createHash('sha256').update(key).digest('hex').slice(0, 32) + '.json');
  writeFileSync(f, JSON.stringify(v));
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export function gitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
  } catch {
    return 'no-git';
  }
}

// ---------------- extraction scoring ----------------
export interface ExtractionCase {
  id: string;
  lang: Lang;
  today?: string;
  transcript: string;
  parties?: string[];
  expected: Partial<ExtractedEntry>[];
  must_ask: boolean;
  tags?: string[];
  notes?: string;
  example?: boolean;
}

export interface ExtractionScore {
  id: string;
  lang: Lang;
  path: string;
  tags: string[];
  expected: number;
  actual: number;
  typeAmountOk: number; // matched entries with right type and amount
  partyChecked: number;
  partyOk: number;
  wrongPerson: number;
  invented: number; // values in the final output not traceable to the note
  caughtByGuard: number; // values the model invented that the guard removed (online only)
  mustAsk: boolean;
  asked: boolean;
  dateChecked: number;
  dateOk: number;
  error?: string;
}

/** Count values in final entries that cannot be traced to the transcript. */
export function inventedValues(entries: ExtractedEntry[], transcript: string): number {
  const nums = new Set(numbersIn(transcript));
  const dateSaid = hasDateWord(transcript);
  let n = 0;
  for (const e of entries) {
    if (e.amount != null && !nums.has(e.amount)) n++;
    if (e.party && !nameInText(e.party, transcript)) n++;
    if (e.due && !dateSaid) n++;
  }
  return n;
}

const samePerson = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && nameKey(a) === nameKey(b);

export function scoreExtraction(c: ExtractionCase, path: string, entries: (ExtractedEntry | DraftEntry)[], caughtByGuard = 0): ExtractionScore {
  const used = new Set<number>();
  let typeAmountOk = 0;
  let partyChecked = 0;
  let partyOk = 0;
  let wrongPerson = 0;
  let dateChecked = 0;
  let dateOk = 0;
  for (const exp of c.expected) {
    // best match: same type and amount, then prefer same party/item
    let best = -1;
    let bestScore = -1;
    entries.forEach((a, i) => {
      if (used.has(i) || a.type !== exp.type || (a.amount ?? null) !== (exp.amount ?? null)) return;
      const s = (samePerson(a.party, exp.party) ? 2 : 0) + (a.item && exp.item && nameKey(a.item) === nameKey(exp.item) ? 1 : 0);
      if (s > bestScore) {
        best = i;
        bestScore = s;
      }
    });
    if (best < 0) continue;
    used.add(best);
    typeAmountOk++;
    const a = entries[best];
    if (exp.party) {
      partyChecked++;
      if (samePerson(a.party, exp.party)) partyOk++;
      else if (a.party) wrongPerson++;
    }
    if (exp.due !== undefined) {
      dateChecked++;
      if ((a.due ?? null) === (exp.due ?? null)) dateOk++;
    }
  }
  const asked = entries.some((e) => !!e.unclear || !!(e as DraftEntry).choices?.length);
  return {
    id: c.id,
    lang: c.lang,
    path,
    tags: [...(c.tags ?? []), `lang:${c.lang}`],
    expected: c.expected.length,
    actual: entries.length,
    typeAmountOk,
    partyChecked,
    partyOk,
    wrongPerson,
    invented: inventedValues(entries, c.transcript),
    caughtByGuard,
    mustAsk: c.must_ask,
    asked,
    dateChecked,
    dateOk,
  };
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : 'n/a');

export function extractionTable(scores: ExtractionScore[], groupBy: (s: ExtractionScore) => string[]): string {
  const groups = new Map<string, ExtractionScore[]>();
  for (const s of scores) for (const g of groupBy(s)) groups.set(g, [...(groups.get(g) ?? []), s]);
  const rows = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  const lines = [
    '| Group | Cases | Invented values (target 0) | Type + amount correct (90%+) | Correct party (95%+) | Wrong person | Asks when unclear (100%) | Dates correct | Caught by guard |',
    '|---|---|---|---|---|---|---|---|---|',
  ];
  for (const [g, list] of rows) {
    const sum = (f: (s: ExtractionScore) => number) => list.reduce((a, s) => a + f(s), 0);
    const denom = sum((s) => Math.max(s.expected, s.actual));
    const must = list.filter((s) => s.mustAsk);
    lines.push(
      `| ${g} | ${list.length} | ${sum((s) => s.invented)} | ${pct(sum((s) => s.typeAmountOk), denom)} | ${pct(sum((s) => s.partyOk), sum((s) => s.partyChecked))} | ${sum((s) => s.wrongPerson)} | ${pct(must.filter((s) => s.asked).length, must.length)} | ${pct(sum((s) => s.dateOk), sum((s) => s.dateChecked))} | ${sum((s) => s.caughtByGuard)} |`,
    );
  }
  return lines.join('\n');
}

export function failuresList(scores: ExtractionScore[]): string {
  const bad = scores.filter((s) => s.error || s.invented || s.wrongPerson || (s.mustAsk && !s.asked) || s.typeAmountOk < Math.max(s.expected, s.actual));
  if (!bad.length) return '_No failing cases._';
  return bad
    .map((s) => {
      const why = [
        s.error && `error: ${s.error}`,
        s.invented && `${s.invented} invented value(s)`,
        s.wrongPerson && `${s.wrongPerson} wrong person`,
        s.mustAsk && !s.asked && 'did not ask',
        s.typeAmountOk < Math.max(s.expected, s.actual) && `type+amount ${s.typeAmountOk}/${Math.max(s.expected, s.actual)}`,
      ]
        .filter(Boolean)
        .join('; ');
      return `- \`${s.id}\` (${s.path}): ${why}`;
    })
    .join('\n');
}

/** Word and character error rate. */
export function errorRates(ref: string, hyp: string): { wer: number; cer: number } {
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const ed = <T>(a: T[], b: T[]) => {
    const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = dp[0];
      dp[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const tmp = dp[j];
        dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = tmp;
      }
    }
    return dp[b.length];
  };
  const r = norm(ref);
  const h = norm(hyp);
  const rw = r ? r.split(' ') : [];
  const hw = h ? h.split(' ') : [];
  return {
    wer: rw.length ? ed(rw, hw) / rw.length : hw.length ? 1 : 0,
    cer: r.length ? ed([...r], [...h]) / r.length : h.length ? 1 : 0,
  };
}
