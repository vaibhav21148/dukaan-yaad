// Guards against Whisper hallucinations on silence/noise ("Thank you for watching", repeated phrases).

const JUNK = [
  /thank(s| you) for watching/gi,
  /please (like and )?subscribe/gi,
  /like,? (share )?(and )?subscribe/gi,
  /subtitles? (by|from)[^.]*\.?/gi,
  /amara\.org[^.]*\.?/gi,
  /\[(music|blank_audio|silence|noise|applause|laughter|inaudible)\]/gi,
  /\((music|silence|noise|applause|laughter|inaudible)\)/gi,
  /[♪♫]+/g,
  /www\.[a-z0-9.-]+/gi,
];
// Outputs that, on their own, are almost always hallucinated from silence.
const LONE_JUNK = /^(thank you|thanks|you|bye|okay|ok|hmm+|uh+|धन्यवाद|शुक्रिया|thank you\.|ty|सब्सक्राइब)[.!\s]*$/i;

/** Collapse an n-gram (1..8 words) repeated 3+ times in a row to a single copy. */
export function collapseRepeats(text: string): string {
  let words = text.split(/\s+/).filter(Boolean);
  for (let n = 8; n >= 1; n--) {
    const out: string[] = [];
    let i = 0;
    while (i < words.length) {
      const gram = words.slice(i, i + n).join(' ').toLowerCase();
      let reps = 1;
      while (i + (reps + 1) * n <= words.length && words.slice(i + reps * n, i + (reps + 1) * n).join(' ').toLowerCase() === gram) reps++;
      if (reps >= 3 && gram) {
        out.push(...words.slice(i, i + n));
        i += reps * n;
      } else {
        out.push(words[i]);
        i++;
      }
    }
    words = out;
  }
  return words.join(' ');
}

export function cleanTranscript(raw: string, speechRatio = 1): string {
  let t = raw ?? '';
  for (const re of JUNK) t = t.replace(re, ' ');
  t = collapseRepeats(t.replace(/\s+/g, ' ').trim());
  if (!t) return '';
  if (LONE_JUNK.test(t)) return '';
  const letters = (t.match(/[\p{L}\p{N}]/gu) ?? []).length;
  if (letters < Math.max(2, t.length * 0.4)) return ''; // mostly punctuation/symbols
  // very little speech in the audio but a long transcript -> hallucination
  if (speechRatio < 0.05) return '';
  if (speechRatio < 0.15 && t.split(' ').length > 25) return '';
  return t;
}
