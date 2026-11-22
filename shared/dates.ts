// Relative date resolution in Hinglish, Hindi, Marathi, Gujarati and English.
// All functions take "today" as YYYY-MM-DD so they are deterministic in tests and evals.

import { asciiDigits } from './numbers.js';

export function isoLocal(d: Date): string {
  const z = new Date(d);
  z.setMinutes(z.getMinutes() - z.getTimezoneOffset());
  return z.toISOString().slice(0, 10);
}
export const todayIso = () => isoLocal(new Date());

export function addDaysIso(base: string, n: number): string {
  const d = new Date(base + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function weekdayOf(iso: string): number {
  return new Date(iso + 'T12:00:00Z').getUTCDay();
}
export const WEEKDAY_EN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Each list: [dayIndex, ...spoken forms]. Data, not code branches.
const WEEKDAYS: [number, string[]][] = [
  [0, ['sunday', 'ravivar', 'raviwar', 'itvar', 'etwar', 'itwar', 'रविवार', 'इतवार', 'રવિવાર', 'ravivaar']],
  [1, ['monday', 'somvar', 'somwar', 'सोमवार', 'સોમવાર', 'somvaar']],
  [2, ['tuesday', 'mangalvar', 'mangalwar', 'mangalvaar', 'मंगलवार', 'मंगळवार', 'મંગળવાર']],
  [3, ['wednesday', 'budhvar', 'budhwar', 'budhvaar', 'बुधवार', 'બુધવાર']],
  [4, ['thursday', 'guruvar', 'guruwar', 'brihaspativar', 'veervar', 'गुरुवार', 'बृहस्पतिवार', 'वीरवार', 'ગુરુવાર']],
  [5, ['friday', 'shukravar', 'shukrawar', 'sukravar', 'शुक्रवार', 'શુક્રવાર']],
  [6, ['saturday', 'shanivar', 'shaniwar', 'शनिवार', 'શનિવાર']],
];

const RELATIVE: [number, string[]][] = [
  [2, ['parso', 'parson', 'parsho', 'day after tomorrow', 'परसों', 'परसो', 'परवा', 'parva', 'પરમદિવસ', 'પરમ દિવસે', 'પરમ દિવસ', 'parmdivas', 'param divas']],
  [1, ['kal', 'kaal', 'tomorrow', 'कल', 'उद्या', 'udya', 'udyaa', 'કાલે', 'કાલ', 'kale', 'kaale']],
  [0, ['aaj', 'aj', 'today', 'tonight', 'आज', 'આજે', 'આજ', 'aaje']],
];
const NEXT_WEEK = ['agle hafte', 'agle week', 'next week', 'अगले हफ्ते', 'अगले हफ़्ते', 'पुढच्या आठवड्यात', 'पुढील आठवड्यात', 'આવતા અઠવાડિયે', 'aavta athvadiye'];
const IN_DAYS = /(\d{1,2})\s*(din|dino|दिन|दिनों|दिवस|दिवसांनी|દિવસ|દિવસમાં|days?)\s*(mein|me|men|baad|में|बाद|नंतर|મા|માં|પછી|later)?/i;
const IN_DAYS_EN = /\bin\s+(\d{1,2})\s+days?\b/i;
const DAY_OF_MONTH = /(\d{1,2})\s*(tarikh|tareekh|taarikh|tarik|तारीख|तारीख़|तारखेला|તારીખે|તારીખ|st|nd|rd|th)\b/i;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAY_MONTH = /(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i;

const reCache = new Map<string, RegExp>();
/** Whole-word search that works for Latin, Devanagari and Gujarati. */
export function containsWord(text: string, w: string, prefixOnly = false): number {
  const ck = w + (prefixOnly ? '|p' : '');
  let re = reCache.get(ck);
  if (!re) {
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
    re = new RegExp(`(?<![\\p{L}\\p{M}])${esc}${prefixOnly ? '' : '(?![\\p{L}\\p{M}])'}`, 'iu');
    reCache.set(ck, re);
  }
  const m = re.exec(text);
  return m ? m.index : -1;
}

function nextWeekday(today: string, idx: number): string {
  const diff = (idx - weekdayOf(today) + 7) % 7 || 7;
  return addDaysIso(today, diff);
}

/** True if the text contains any date expression at all. */
export function hasDateWord(text: string): boolean {
  return resolveDate(text, '2000-01-01') !== null;
}

/**
 * Resolve the first date expression in the text to YYYY-MM-DD, or null.
 * "kal" means tomorrow here; callers only use this for things that are due.
 */
export function resolveDate(input: string, today: string): string | null {
  const text = asciiDigits(input.toLowerCase());
  let m: RegExpExecArray | null;
  if ((m = DAY_MONTH.exec(text))) {
    const day = +m[1];
    const mon = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    let y = +today.slice(0, 4);
    const cand = `${y}-${String(mon + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (cand < today) y++;
    return `${y}-${String(mon + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  if ((m = DAY_OF_MONTH.exec(text))) {
    const day = +m[1];
    if (day >= 1 && day <= 31) {
      let [y, mo] = [+today.slice(0, 4), +today.slice(5, 7)];
      if (day < +today.slice(8, 10)) {
        mo++;
        if (mo > 12) {
          mo = 1;
          y++;
        }
      }
      return `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  if ((m = IN_DAYS_EN.exec(text)) || (m = IN_DAYS.exec(text))) {
    const n = +m[1];
    if (n > 0 && n < 90) return addDaysIso(today, n);
  }
  // earliest mention wins between weekday / relative / next-week
  let best: { pos: number; date: string } | null = null;
  const consider = (pos: number, date: string) => {
    if (pos >= 0 && (!best || pos < best.pos)) best = { pos, date };
  };
  // Indic weekday names may carry a glued suffix (शुक्रवारपर्यंत), so match them as prefixes.
  for (const [idx, words] of WEEKDAYS) for (const w of words) consider(containsWord(text, w, /[^a-z ]/i.test(w)), nextWeekday(today, idx));
  for (const w of NEXT_WEEK) consider(containsWord(text, w), addDaysIso(today, 7));
  for (const [n, words] of RELATIVE) for (const w of words) {
    const p = containsWord(text, w);
    // "kal" inside "next week" style phrases is already handled; skip "aaj kal" (= nowadays)
    if (p >= 0 && /aaj\s*kal|आजकल/.test(text) && n !== 2) continue;
    consider(p, addDaysIso(today, n));
  }
  return (best as { pos: number; date: string } | null)?.date ?? null;
}
