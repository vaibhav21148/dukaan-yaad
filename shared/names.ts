// Party-name normalisation and fuzzy matching.
import { phoneticKey, toRoman } from './translit.js';

// Honorifics / suffixes stripped before matching, in all four languages.
export const HONORIFICS = [
  'ji', 'jee', 'bhai', 'bhaiya', 'bhaiyya', 'bhau', 'uncle', 'aunty', 'auntie', 'didi', 'behen', 'ben', 'bai', 'tai', 'kaka', 'kaku', 'mama', 'mami',
  'seth', 'sheth', 'shet', 'sahab', 'saab', 'saheb', 'sahib', 'rao', 'mr', 'mrs', 'shri', 'shree', 'sri',
  'distributor', 'distributors', 'supplier', 'agency', 'agencies', 'traders', 'trader', 'enterprises', 'wale', 'wala', 'wali', 'vala', 'vale', 'waale', 'waala', 'vado', 'vala',
  'जी', 'भाई', 'भैया', 'अंकल', 'आंटी', 'दीदी', 'सेठ', 'शेठ', 'साहब', 'साहेब', 'वाले', 'वाला', 'वाली', 'राव', 'भाऊ', 'ताई', 'काका', 'मामा', 'श्री', 'डिस्ट्रीब्यूटर',
  'ભાઈ', 'શેઠ', 'જી', 'સાહેબ', 'કાકા', 'બેન', 'વાળા', 'વાળો', 'મામા', 'શ્રી',
];
const HON_SET = new Set(HONORIFICS.map((h) => h.toLowerCase()));

/** Lowercase, strip punctuation, keep letters of all scripts. */
export function cleanName(n: string | null | undefined): string {
  return (n ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\d ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Name without honorifics: "Sharma uncle" -> "sharma". */
export function nameCore(n: string | null | undefined): string {
  const words = cleanName(n).split(' ').filter(Boolean);
  const kept = words.filter((w) => !HON_SET.has(w));
  return (kept.length ? kept : words).join(' ');
}

/** Phonetic key of the core name, script-independent. */
export function nameKey(n: string | null | undefined): string {
  return nameCore(n)
    .split(' ')
    .map(phoneticKey)
    .filter(Boolean)
    .join(' ');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
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
}

export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

export interface PartyLike {
  id: string;
  name: string;
  aliases: string[];
}

export type MatchResult =
  | { kind: 'exact'; party: PartyLike }
  | { kind: 'one'; party: PartyLike }
  | { kind: 'many'; parties: PartyLike[] }
  | { kind: 'none' };

/**
 * Match a spoken name to known parties.
 * - exact: the spoken form equals a saved name or alias (honorifics included)
 * - one:   one party shares the core name ("Sharma uncle" -> "Sharma ji")
 * - many:  two or more could match -> the owner must choose
 */
export function matchParty(spoken: string | null | undefined, parties: PartyLike[]): MatchResult {
  const s = cleanName(spoken);
  if (!s) return { kind: 'none' };
  const sRoman = cleanName(toRoman(s));
  for (const p of parties) {
    const forms = [p.name, ...p.aliases].map((f) => cleanName(f));
    if (forms.some((f) => f === s || cleanName(toRoman(f)) === sRoman)) return { kind: 'exact', party: p };
  }
  const key = nameKey(s);
  if (!key) return { kind: 'none' };
  const scored: { p: PartyLike; score: number }[] = [];
  for (const p of parties) {
    let best = 0;
    for (const f of [p.name, ...p.aliases]) {
      const k = nameKey(f);
      if (!k) continue;
      let sc = k === key ? 1 : similarity(k, key);
      // "Sharma" vs "Sharma Kirana": first-word match counts as close
      if (sc < 0.8 && k.split(' ')[0] === key.split(' ')[0] && key.split(' ')[0].length >= 3) sc = 0.85;
      best = Math.max(best, sc);
    }
    if (best >= 0.8) scored.push({ p, score: best });
  }
  if (!scored.length) return { kind: 'none' };
  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter((x) => x.score >= scored[0].score - 0.15);
  if (top.length === 1) return { kind: 'one', party: top[0].p };
  return { kind: 'many', parties: top.map((x) => x.p) };
}

/** Does the transcript contain this name (in any script)? Used by the never-invent guard. */
export function nameInText(name: string, text: string): boolean {
  const core = nameCore(name).split(' ').filter((w) => w.length >= 2);
  if (!core.length) return false;
  const textWords = cleanName(text).split(' ');
  const textKeys = new Set(textWords.map(phoneticKey));
  const textRoman = new Set(textWords.map((w) => cleanName(toRoman(w))));
  return core.some((w) => textRoman.has(cleanName(toRoman(w))) || textKeys.has(phoneticKey(w)));
}
