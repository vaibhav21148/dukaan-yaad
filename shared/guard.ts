// The "never invent" rule, enforced in code for BOTH extraction paths.
// Any amount, name, item or date that cannot be traced to the spoken note is
// removed and the card is marked unclear with one short question.
import { hasDateWord } from './dates.js';
import { doubt, type DoubtKey } from './messages.js';
import { nameInText, cleanName } from './names.js';
import { normalizeNumbers, numbersIn } from './numbers.js';
import { phoneticKey, toRoman } from './translit.js';
import type { ExtractedEntry, Lang } from './types.js';

export interface GuardReport {
  entries: ExtractedEntry[];
  nulled: { index: number; field: 'amount' | 'party' | 'item' | 'due' }[];
}

const AMOUNT_Q: Record<string, DoubtKey> = {
  supplier_due: 'howMuchDue',
  supplier_paid: 'howMuchPaid',
  credit_given: 'howMuchCredit',
  credit_received: 'howMuchReceived',
};

function itemInText(item: string, text: string): boolean {
  const words = cleanName(item).split(' ').filter((w) => w.length >= 2 && !/^\d+$/.test(w));
  if (!words.length) return /\d/.test(item) && numbersIn(text).length > 0;
  const tWords = cleanName(text).split(' ');
  const tKeys = new Set(tWords.map(phoneticKey));
  const tRoman = new Set(tWords.map((w) => cleanName(toRoman(w))));
  const textLower = text.toLowerCase();
  return words.some((w) => textLower.includes(w) || tRoman.has(cleanName(toRoman(w))) || tKeys.has(phoneticKey(w)));
}

export function neverInvent(entries: ExtractedEntry[], transcript: string, lang: Lang): GuardReport {
  const normalized = normalizeNumbers(transcript);
  const spokenNumbers = new Set(numbersIn(transcript));
  const dateSpoken = hasDateWord(transcript);
  const nulled: GuardReport['nulled'] = [];
  const out = entries.map((e, index) => {
    const x = { ...e };
    const ask: string[] = [];
    if (x.amount != null) {
      const ok = spokenNumbers.has(x.amount) || normalized.includes(String(x.amount));
      if (!ok) {
        x.amount = null;
        nulled.push({ index, field: 'amount' });
        ask.push(doubt(lang, 'amountNotHeard'));
      }
    }
    if (x.party && !nameInText(x.party, transcript)) {
      x.party = null;
      nulled.push({ index, field: 'party' });
      ask.push(doubt(lang, 'nameNotHeard'));
    }
    if (x.item && !itemInText(x.item, transcript)) {
      x.item = null;
      nulled.push({ index, field: 'item' });
      ask.push(doubt(lang, 'itemNotHeard'));
    }
    if (x.due && !dateSpoken) {
      x.due = null;
      nulled.push({ index, field: 'due' });
      ask.push(doubt(lang, 'dateNotHeard'));
    }
    // Missing values that matter get a question too.
    if (x.amount == null && AMOUNT_Q[x.type] && !ask.length && !x.unclear) ask.push(doubt(lang, AMOUNT_Q[x.type]));
    if (x.type === 'reorder' && !x.item && !ask.length && !x.unclear) ask.push(doubt(lang, 'whatItem'));
    if (ask.length) x.unclear = [x.unclear, ...ask].filter(Boolean).join(' ');
    if (!x.quote) x.quote = '';
    return x;
  });
  return { entries: out, nulled };
}
