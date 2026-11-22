// Poochho: online answer when possible, local answer otherwise. Both use ONLY the saved snapshot.
import { numbersIn } from '../../shared/numbers';
import type { Lang, LedgerSnapshot } from '../../shared/types';
import { fetchWithTimeout } from '../lib/hash';
import { answerLocal } from './local';

export interface AskResult {
  answer: string;
  by: 'local' | 'gemini' | 'groq' | 'anthropic';
}

/** Every number in an AI answer must be a saved amount, a sum of saved amounts, or a count. */
export function answerIsGrounded(answer: string, s: LedgerSnapshot): boolean {
  const amounts = [...s.suppliers_owed.map((x) => x.amount), ...s.customers_owe.map((x) => x.amount)];
  const allowed = new Set<number>(amounts.map((a) => Math.round(a)));
  allowed.add(Math.round(s.suppliers_owed.reduce((a, x) => a + x.amount, 0)));
  allowed.add(Math.round(s.customers_owe.reduce((a, x) => a + x.amount, 0)));
  for (let i = 0; i <= Math.max(s.suppliers_owed.length, s.customers_owe.length, s.to_reorder.length, s.pending_orders.length) + 1; i++) allowed.add(i);
  // dates and quantities that appear in the data are fine too
  const dataNums = new Set(numbersIn(JSON.stringify(s)).map(Math.round));
  const nums = numbersIn(answer.replace(/(\d),(?=\d)/g, '$1'));
  return nums.every((n) => allowed.has(Math.round(n)) || dataNums.has(Math.round(n)));
}

export async function ask(question: string, s: LedgerSnapshot, lang: Lang, online: boolean): Promise<AskResult> {
  const local = (): AskResult => ({ answer: answerLocal(question, s, lang), by: 'local' });
  if (!online || (typeof navigator !== 'undefined' && !navigator.onLine)) return local();
  try {
    const res = await fetchWithTimeout('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question, ledger: s, lang }) }, 10000);
    if (!res.ok) return local();
    const body = await res.json();
    if (body.fallback || typeof body.answer !== 'string' || !body.answer.trim()) return local();
    if (!answerIsGrounded(body.answer, s)) return local();
    return { answer: body.answer.trim(), by: body.by ?? 'gemini' };
  } catch {
    return local();
  }
}
