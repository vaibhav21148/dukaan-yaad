// npm run eval -> runs extraction, ask and STT evals and writes evals/report.md (+ a timestamped copy in evals/reports/).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROMPT_VERSION } from '../shared/prompts';
import { configuredProviders } from '../api/_lib/llm';
import { EVALS, gitHash } from './lib';
import { runAsk } from './run-ask';
import { runExtraction } from './run-extraction';
import { runStt } from './run-stt';

const started = new Date();
if (!process.argv.includes('--provider')) process.argv.push('--provider', 'all');
const ex = await runExtraction();
const ask = await runAsk();
const stt = process.argv.includes('--skip-stt') ? { md: '## Speech-to-text\n\n_Skipped (--skip-stt)._' } : await runStt();
const md = [
  '# Dukaan Yaad eval report',
  '',
  `- Generated: ${started.toISOString()}`,
  `- Git commit: \`${gitHash()}\``,
  `- Prompt version: \`${PROMPT_VERSION}\``,
  `- Online providers with keys: ${configuredProviders().join(', ') || 'none (offline path only)'}`,
  '',
  ex.md,
  '',
  ask.md,
  '',
  stt.md,
  '',
].join('\n');
writeFileSync(join(EVALS, 'report.md'), md);
mkdirSync(join(EVALS, 'reports'), { recursive: true });
const stamp = started.toISOString().replace(/[:.]/g, '-').slice(0, 19);
writeFileSync(join(EVALS, 'reports', `report-${stamp}-${gitHash()}.md`), md);
console.log(md);
