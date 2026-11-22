// Spoken-number normalisation for Hinglish, Hindi, Marathi, Gujarati and English.
// "teen sau pachas" -> "350", "dedh hazaar" -> "1500", "पाँच सौ" -> "500", "૫૦૦" -> "500".
// Only rewrites number words; every other character is kept as spoken.

const UNITS: Record<string, number> = {};
const add = (n: number, ...words: string[]) => words.forEach((w) => (UNITS[w] = n));

// ---- Hinglish / Roman Hindi ----
add(1, 'ek', 'ekk');
add(2, 'do', 'doh');
add(3, 'teen', 'tin');
add(4, 'char', 'chaar', 'chār');
add(5, 'paanch', 'panch', 'paanc', 'paach', 'pach');
add(6, 'chhe', 'chhah', 'chah', 'che', 'chhai');
add(7, 'saat', 'sat');
add(8, 'aath', 'ath');
add(9, 'nau');
add(10, 'das', 'dus');
add(11, 'gyarah', 'gyara', 'gyaarah');
add(12, 'barah', 'bara', 'baarah');
add(13, 'terah', 'tera');
add(14, 'chaudah', 'chauda', 'choudah');
add(15, 'pandrah', 'pandra', 'pandhra');
add(16, 'solah', 'sola');
add(17, 'satrah', 'satra');
add(18, 'atharah', 'athara', 'attharah');
add(19, 'unnis', 'unees', 'unnees');
add(20, 'bees', 'bis');
add(21, 'ikkis', 'ikkees');
add(22, 'bais', 'baees', 'baaees');
add(23, 'teis', 'teyis');
add(24, 'chaubis', 'chaubees', 'choubis');
add(25, 'pachchis', 'pachees', 'pacchis', 'pachis');
add(26, 'chhabbis', 'chabbis');
add(27, 'sattais', 'sattaees');
add(28, 'atthais', 'athais', 'atthaees');
add(29, 'untis', 'untees');
add(30, 'tees', 'tis');
add(35, 'paintis', 'paitis');
add(40, 'chalis', 'chaalis', 'chalees');
add(45, 'paintalis', 'paitalis');
add(50, 'pachas', 'pachaas', 'pachaas');
add(55, 'pachpan');
add(60, 'saath', 'sath');
add(65, 'painsath');
add(70, 'sattar', 'sattur');
add(75, 'pachhattar', 'pachattar', 'pachhatar');
add(80, 'assi', 'assee');
add(85, 'pachasi');
add(90, 'nabbe', 'nabbey', 'nabbay');
add(95, 'pachanve', 'pachaanve');
add(99, 'ninyanve', 'ninnyanve');
// Roman Marathi / Gujarati forms that differ
add(2, 'don');
add(6, 'saha');
add(9, 'nav', 'nau');
add(10, 'daha');
add(20, 'vees', 'vis');
add(50, 'pannas');
add(3, 'tran');
// ---- Devanagari Hindi ----
add(1, 'एक');
add(2, 'दो');
add(3, 'तीन');
add(4, 'चार');
add(5, 'पांच', 'पाच');
add(6, 'छह', 'छः', 'छे');
add(7, 'सात');
add(8, 'आठ');
add(9, 'नौ');
add(10, 'दस');
add(11, 'ग्यारह');
add(12, 'बारह');
add(13, 'तेरह');
add(14, 'चौदह');
add(15, 'पंद्रह', 'पन्द्रह');
add(16, 'सोलह');
add(17, 'सत्रह');
add(18, 'अठारह');
add(19, 'उन्नीस');
add(20, 'बीस');
add(21, 'इक्कीस');
add(22, 'बाईस');
add(23, 'तेईस');
add(24, 'चौबीस');
add(25, 'पच्चीस');
add(30, 'तीस');
add(35, 'पैंतीस');
add(40, 'चालीस');
add(45, 'पैंतालीस');
add(50, 'पचास');
add(55, 'पचपन');
add(60, 'साठ');
add(65, 'पैंसठ');
add(70, 'सत्तर');
add(75, 'पचहत्तर');
add(80, 'अस्सी');
add(85, 'पचासी');
add(90, 'नब्बे');
add(95, 'पंचानवे');
// ---- Marathi ----
add(2, 'दोन');
add(5, 'पाच');
add(6, 'सहा');
add(9, 'नऊ');
add(10, 'दहा');
add(11, 'अकरा');
add(12, 'बारा');
add(13, 'तेरा');
add(14, 'चौदा');
add(15, 'पंधरा');
add(16, 'सोळा');
add(17, 'सतरा');
add(18, 'अठरा');
add(19, 'एकोणीस');
add(20, 'वीस');
add(25, 'पंचवीस');
add(35, 'पस्तीस');
add(40, 'चाळीस');
add(45, 'पंचेचाळीस');
add(50, 'पन्नास');
add(55, 'पंचावन्न');
add(65, 'पासष्ट');
add(75, 'पंचाहत्तर');
add(80, 'ऐंशी');
add(85, 'पंच्याऐंशी');
add(90, 'नव्वद');
add(95, 'पंचाण्णव');
// ---- Gujarati ----
add(1, 'એક');
add(2, 'બે');
add(3, 'ત્રણ');
add(4, 'ચાર');
add(5, 'પાંચ');
add(6, 'છ');
add(7, 'સાત');
add(8, 'આઠ');
add(9, 'નવ');
add(10, 'દસ');
add(11, 'અગિયાર');
add(12, 'બાર');
add(13, 'તેર');
add(14, 'ચૌદ');
add(15, 'પંદર');
add(16, 'સોળ');
add(17, 'સત્તર');
add(18, 'અઢાર');
add(19, 'ઓગણીસ');
add(20, 'વીસ');
add(25, 'પચીસ');
add(30, 'ત્રીસ');
add(35, 'પાંત્રીસ');
add(40, 'ચાલીસ');
add(45, 'પિસ્તાળીસ');
add(50, 'પચાસ');
add(55, 'પંચાવન');
add(60, 'સાઠ');
add(65, 'પાંસઠ');
add(70, 'સિત્તેર');
add(75, 'પંચોતેર');
add(80, 'એંસી');
add(85, 'પંચ્યાસી');
add(90, 'નેવું');
add(95, 'પંચાણું');
// ---- English ----
['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'].forEach(
  (w, i) => i > 0 && add(i, w),
);
['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'].forEach((w, i) => add((i + 2) * 10, w));

// Fractions that act as a unit value: "dedh sau" = 150, "dhai hazaar" = 2500
const FRACTION_UNITS: Record<string, number> = {
  dedh: 1.5, dedhh: 1.5, derh: 1.5, 'डेढ': 1.5, 'दीड': 1.5, did: 1.5, 'દોઢ': 1.5, dodh: 1.5,
  dhai: 2.5, dhaai: 2.5, adhai: 2.5, 'ढाई': 2.5, 'अडीच': 2.5, adich: 2.5, 'અઢી': 2.5, adhi: 2.5,
};
// Modifiers applied to the next unit: "saadhe teen sau" = 350
const MODIFIERS: Record<string, number> = {
  sadhe: 0.5, saadhe: 0.5, sade: 0.5, saade: 0.5, 'साढे': 0.5, 'साडे': 0.5, 'સાડા': 0.5, sada: 0.5,
  sava: 0.25, sawa: 0.25, savva: 0.25, 'सवा': 0.25, 'सव्वा': 0.25, 'સવા': 0.25,
  paune: -0.25, pone: -0.25, 'पौने': -0.25, 'पावणे': -0.25, 'પોણા': -0.25,
};
const HUNDRED = new Set(['sau', 'so', 'saw', 'hundred', 'सौ', 'shambhar', 'शंभर', 'સો']);
const THOUSAND = new Set(['hazaar', 'hazar', 'hajar', 'hajaar', 'hazār', 'thousand', 'हजार', 'हज़ार', 'હજાર', 'k']);
const LAKH = new Set(['lakh', 'lac', 'laakh', 'lakhs', 'लाख', 'લાખ']);
const CRORE = new Set(['crore', 'karod', 'करोड़', 'करोड', 'કરોડ']);

// Words that are also everyday non-number words; only a number when next to a
// multiplier, a unit, currency, or another number word.
const AMBIGUOUS = new Set(['do', 'saath', 'sath', 'sat', 'tin', 'so', 'saw', 'nav', 'be', 'bis', 'tis', 'pach', 'ath', 'chhe', 'che', 'k', 'don', 'did', 'adhi', 'sada', 'pone', 'tran', 'vis', 'one']);
const UNIT_OF_MEASURE =
  /^(kilo|kg|kgs|kilogram|gram|gm|g|litre|liter|ltr|l|packet|packets|pkt|peti|bori|dabba|dabbe|box|carton|piece|pc|pcs|dozen|darjan|bottle|bottles|bag|bags|rupaye|rupaya|rupees|rupee|rs|₹|किलो|लीटर|पैकेट|रुपये|रुपए|रुपया|रुपयांचे|रुपये|કિલો|રૂપિયા|પેકેટ)$/i;

/** Lookup key: lowercase, ignore nukta / chandrabindu differences. */
function key(w: string): string {
  return w
    .toLowerCase()
    .replace(/़/g, '') // nukta
    .replace(/ँ/g, 'ं') // chandrabindu -> anusvara
    .replace(/઼/g, '');
}

const KEYED_UNITS: Record<string, number> = {};
for (const [w, n] of Object.entries(UNITS)) KEYED_UNITS[key(w)] = n;
const KEYED_FRAC: Record<string, number> = {};
for (const [w, n] of Object.entries(FRACTION_UNITS)) KEYED_FRAC[key(w)] = n;
const KEYED_MOD: Record<string, number> = {};
for (const [w, n] of Object.entries(MODIFIERS)) KEYED_MOD[key(w)] = n;
const has = (set: Set<string>, w: string) => set.has(w) || [...set].some((s) => key(s) === w);

/** Convert Devanagari and Gujarati digits to ASCII, drop thousands commas. */
export function asciiDigits(s: string): string {
  return s
    .replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966))
    .replace(/[૦-૯]/g, (d) => String(d.charCodeAt(0) - 0x0ae6))
    .replace(/(\d),(?=\d{2,3}(?!\d))/g, '$1');
}

type Kind = 'digit' | 'unit' | 'frac' | 'mod' | 'h' | 't' | 'l' | 'c' | null;
function kind(tok: string): Kind {
  const k = key(tok);
  if (/^\d+(\.\d+)?k?$/.test(k)) return 'digit';
  if (k in KEYED_FRAC) return 'frac';
  if (k in KEYED_MOD) return 'mod';
  if (has(HUNDRED, k)) return 'h';
  if (has(THOUSAND, k)) return 't';
  if (has(LAKH, k)) return 'l';
  if (has(CRORE, k)) return 'c';
  if (k in KEYED_UNITS) return 'unit';
  return null;
}

const TOKEN_RE = /\d+(?:\.\d+)?k?(?![\p{L}])|[\p{L}\p{M}]+|[^\p{L}\p{M}\d]+|\d+/gu;

/**
 * Replace spoken numbers with digits. Keeps all other text as-is.
 */
export function normalizeNumbers(input: string): string {
  const text = asciiDigits(input);
  const toks = text.match(TOKEN_RE) ?? [];
  const out: string[] = [];
  let i = 0;
  const isSpace = (t: string | undefined) => t !== undefined && /^\s+$/.test(t);
  const nextWord = (j: number) => {
    let n = j + 1;
    while (n < toks.length && isSpace(toks[n])) n++;
    return { idx: n, tok: toks[n] };
  };
  const prevWordKind = (outArr: string[]) => {
    for (let n = outArr.length - 1; n >= 0; n--) {
      if (isSpace(outArr[n])) continue;
      return /^\d+(\.\d+)?$/.test(outArr[n]) ? 'digit' : null;
    }
    return null;
  };

  while (i < toks.length) {
    const t = toks[i];
    const k0 = kind(t);
    if (!k0) {
      out.push(t);
      i++;
      continue;
    }
    // Ambiguous words need support from a neighbour.
    if (AMBIGUOUS.has(key(t)) && k0 !== 'digit') {
      const nw = nextWord(i).tok;
      const nk = nw ? kind(nw) : null;
      const supported =
        (nk && nk !== 'unit' && nk !== 'mod') ||
        (nw && UNIT_OF_MEASURE.test(nw)) ||
        (k0 === 'h' || k0 === 't') && prevWordKind(out) === 'digit';
      if (!supported) {
        out.push(t);
        i++;
        continue;
      }
    }
    // A lone multiplier word with nothing before it ("hazaar baar") is not a number.
    if ((k0 === 'h' || k0 === 't' || k0 === 'l' || k0 === 'c') && key(t) !== 'k') {
      // handled inside the run below only if a number precedes; otherwise "ek hazaar" style
    }

    // Consume a run of number tokens.
    let total = 0;
    let current: number | null = null;
    let mod = 0;
    let lastKind: Kind = null;
    let j = i;
    let consumedEnd = i - 1;
    let ok = false;
    while (j < toks.length) {
      const tk = toks[j];
      if (isSpace(tk)) {
        j++;
        continue;
      }
      const kk = kind(tk);
      if (!kk) break;
      if (AMBIGUOUS.has(key(tk)) && kk !== 'digit' && j !== i) {
        // inside a run, ambiguous words are fine when they follow a number ("do sau", "teen sau do")
      }
      if (kk === 'digit') {
        if (current !== null || (lastKind && lastKind !== 'mod' && lastKind !== 't' && lastKind !== 'l' && lastKind !== 'c')) break;
        let v = parseFloat(key(tk));
        if (/k$/i.test(tk)) v *= 1000;
        current = v + mod;
        mod = 0;
      } else if (kk === 'unit' || kk === 'frac') {
        const v = kk === 'unit' ? KEYED_UNITS[key(tk)] : KEYED_FRAC[key(tk)];
        if (current === null) {
          current = v + mod;
          mod = 0;
        } else if (lastKind === 'h' && current % 100 === 0 && v < 100) {
          current += v;
        } else if (lastKind === 'unit' && current % 10 === 0 && current < 100 && v < 10 && current >= 20) {
          current += v; // "twenty five"
        } else break;
      } else if (kk === 'mod') {
        if (current !== null) break;
        mod = KEYED_MOD[key(tk)];
      } else if (kk === 'h') {
        if (lastKind === 'h') break;
        current = (current ?? 1) * 100;
      } else if (kk === 't') {
        if (current === null && total === 0 && key(tk) === 'k') break;
        if (current === null && total === 0 && j === i) {
          break; // bare "hazaar" with no number
        }
        total += (current ?? 1) * 1000;
        current = null;
      } else if (kk === 'l') {
        if (current === null && total === 0) break;
        total = (total + (current ?? 1)) * 100000;
        current = null;
      } else if (kk === 'c') {
        if (current === null && total === 0) break;
        total = (total + (current ?? 1)) * 10000000;
        current = null;
      }
      lastKind = kk;
      ok = true;
      consumedEnd = j;
      j++;
    }
    if (!ok || consumedEnd < i) {
      out.push(t);
      i++;
      continue;
    }
    const value = total + (current ?? 0);
    if (mod && current === null && total === 0) {
      out.push(t);
      i++;
      continue;
    }
    out.push(formatNum(value));
    i = consumedEnd + 1;
  }
  return out.join('');
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/** All numbers present in a text after normalisation. */
export function numbersIn(text: string): number[] {
  return (normalizeNumbers(text).match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
}

export const UNIT_RE = UNIT_OF_MEASURE;
