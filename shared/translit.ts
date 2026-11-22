// Rough Devanagari / Gujarati -> Roman transliteration, used only for matching
// ("शर्मा जी" should match "Sharma ji"). Not shown to users.

const CONS: Record<string, string> = {
  क: 'k', ख: 'kh', ग: 'g', घ: 'gh', ङ: 'n', च: 'ch', छ: 'chh', ज: 'j', झ: 'jh', ञ: 'n',
  ट: 't', ठ: 'th', ड: 'd', ढ: 'dh', ण: 'n', त: 't', थ: 'th', द: 'd', ध: 'dh', न: 'n',
  प: 'p', फ: 'ph', ब: 'b', भ: 'bh', म: 'm', य: 'y', र: 'r', ल: 'l', ळ: 'l', व: 'v',
  श: 'sh', ष: 'sh', स: 's', ह: 'h',
  ક: 'k', ખ: 'kh', ગ: 'g', ઘ: 'gh', ચ: 'ch', છ: 'chh', જ: 'j', ઝ: 'jh', ટ: 't', ઠ: 'th',
  ડ: 'd', ઢ: 'dh', ણ: 'n', ત: 't', થ: 'th', દ: 'd', ધ: 'dh', ન: 'n', પ: 'p', ફ: 'ph',
  બ: 'b', ભ: 'bh', મ: 'm', ય: 'y', ર: 'r', લ: 'l', ળ: 'l', વ: 'v', શ: 'sh', ષ: 'sh',
  સ: 's', હ: 'h',
};
const VOWELS: Record<string, string> = {
  अ: 'a', आ: 'aa', इ: 'i', ई: 'ee', उ: 'u', ऊ: 'oo', ऋ: 'ri', ए: 'e', ऐ: 'ai', ओ: 'o', औ: 'au',
  અ: 'a', આ: 'aa', ઇ: 'i', ઈ: 'ee', ઉ: 'u', ઊ: 'oo', ઋ: 'ri', એ: 'e', ઐ: 'ai', ઓ: 'o', ઔ: 'au',
};
const MATRAS: Record<string, string> = {
  'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o',
  'ા': 'aa', 'િ': 'i', 'ી': 'ee', 'ુ': 'u', 'ૂ': 'oo', 'ૃ': 'ri', 'ે': 'e', 'ૈ': 'ai', 'ો': 'o', 'ૌ': 'au', 'ૉ': 'o',
};
const VIRAMA = new Set(['्', '્']);
const NASAL = new Set(['ं', 'ँ', 'ં', 'ઁ']);
const NUKTA = new Set(['़', '઼']);

export function hasIndicScript(s: string): boolean {
  return /[ऀ-ॿ઀-૿]/.test(s);
}

export function toRoman(s: string): string {
  if (!hasIndicScript(s)) return s;
  let out = '';
  const chars = [...s];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (CONS[c]) {
      out += CONS[c];
      let j = i + 1;
      while (j < chars.length && NUKTA.has(chars[j])) j++;
      const n = chars[j];
      if (n && VIRAMA.has(n)) {
        i = j;
        continue;
      }
      if (n && MATRAS[n]) {
        out += MATRAS[n];
        i = j;
        continue;
      }
      // inherent vowel, dropped at the end of a word
      if (n && /[ऀ-ॿ઀-૿]/.test(n)) out += 'a';
      i = j - 1;
      continue;
    }
    if (VOWELS[c]) {
      out += VOWELS[c];
      continue;
    }
    if (NASAL.has(c)) {
      out += 'n';
      continue;
    }
    if (MATRAS[c] || VIRAMA.has(c) || NUKTA.has(c)) continue;
    out += c;
  }
  return out;
}

/**
 * A loose phonetic key: Roman, lowercase, vowels after the first letter removed,
 * common spelling variants merged. "Sharma" / "शर्मा" / "Sharmaa" -> "shrm".
 */
export function phoneticKey(word: string): string {
  let w = toRoman(word).toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return '';
  w = w
    .replace(/ph/g, 'f')
    .replace(/w/g, 'v')
    .replace(/z/g, 'j')
    .replace(/q/g, 'k')
    .replace(/ck/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/([bcdgjkpt])h/g, '$1')
    .replace(/sh/g, 's');
  const first = w[0];
  const rest = w.slice(1).replace(/[aeiouy]/g, '');
  return (first + rest).replace(/(.)\1+/g, '$1');
}
