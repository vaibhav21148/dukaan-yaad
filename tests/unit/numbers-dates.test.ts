import { describe, expect, it } from 'vitest';
import { addDaysIso, hasDateWord, resolveDate } from '../../shared/dates';
import { asciiDigits, normalizeNumbers, numbersIn } from '../../shared/numbers';

describe('normalizeNumbers: spoken numbers in 4 languages', () => {
  const cases: [string, string][] = [
    ['paanch sau', '500'],
    ['pachas hazaar', '50000'],
    ['teen sau pachas', '350'],
    ['dedh hazaar', '1500'],
    ['dhai sau', '250'],
    ['saadhe teen sau', '350'],
    ['ek hazaar paanch sau', '1500'],
    ['do lakh pachas hazaar', '250000'],
    ['5 hazaar', '5000'],
    ['2.5 lakh', '250000'],
    ['5k', '5000'],
    ['पाँच सौ', '500'],
    ['डेढ़ हज़ार', '1500'],
    ['ढाई सौ', '250'],
    ['पाच हजार', '5000'],
    ['दीड हजार', '1500'],
    ['तीनशे', 'तीनशे'], // unknown compound stays untouched rather than guessed
    ['પાંચ સો', '500'],
    ['દોઢ હજાર', '1500'],
    ['fifteen hundred', '1500'],
    ['twenty five', '25'],
    ['five thousand', '5000'],
  ];
  for (const [inp, out] of cases) it(`${inp} -> ${out}`, () => expect(normalizeNumbers(inp)).toBe(out));

  it('converts Devanagari and Gujarati digits', () => {
    expect(asciiDigits('५००')).toBe('500');
    expect(asciiDigits('૧૫૦૦')).toBe('1500');
    expect(asciiDigits('1,500')).toBe('1500');
  });
  it('keeps the rest of the sentence intact', () => {
    expect(normalizeNumbers('Ramesh ko paanch sau dena hai')).toBe('Ramesh ko 500 dena hai');
  });
  it('does not turn everyday words into numbers', () => {
    expect(normalizeNumbers('200 de do')).toBe('200 de do');
    expect(normalizeNumbers('Sharma ji ke saath gaya')).toBe('Sharma ji ke saath gaya');
    expect(normalizeNumbers('so I paid')).toBe('so I paid');
  });
  it('ambiguous words count when next to a unit or multiplier', () => {
    expect(normalizeNumbers('do kilo chawal')).toBe('2 kilo chawal');
    expect(normalizeNumbers('do sau')).toBe('200');
  });
  it('numbersIn lists normalised numbers', () => {
    expect(numbersIn('teen sau aur 50')).toEqual([300, 50]);
  });
});

describe('resolveDate', () => {
  const today = '2026-11-22'; // Sunday
  it('aaj / kal / parso in all languages', () => {
    expect(resolveDate('aaj dena hai', today)).toBe(today);
    expect(resolveDate('kal tak', today)).toBe('2026-11-23');
    expect(resolveDate('parso', today)).toBe('2026-11-24');
    expect(resolveDate('कल तक देना', today)).toBe('2026-11-23');
    expect(resolveDate('उद्या द्यायचे', today)).toBe('2026-11-23');
    expect(resolveDate('परवा', today)).toBe('2026-11-24');
    expect(resolveDate('કાલે આપવાના', today)).toBe('2026-11-23');
    expect(resolveDate('tomorrow', today)).toBe('2026-11-23');
  });
  it('weekday names in 4 languages, next occurrence', () => {
    expect(resolveDate('Friday tak', today)).toBe('2026-11-27');
    expect(resolveDate('shukravar ko', today)).toBe('2026-11-27');
    expect(resolveDate('शुक्रवार तक', today)).toBe('2026-11-27');
    expect(resolveDate('शुक्रवारपर्यंत', today)).toBe('2026-11-27');
    expect(resolveDate('શુક્રવાર સુધી', today)).toBe('2026-11-27');
    expect(resolveDate('somvar', today)).toBe('2026-11-23');
    expect(resolveDate('Sunday', today)).toBe('2026-11-29'); // same weekday -> next week
  });
  it('tarikh, day+month, in N days, next week', () => {
    expect(resolveDate('25 tarikh tak', today)).toBe('2026-11-25');
    expect(resolveDate('5 tarikh', today)).toBe('2026-12-05');
    expect(resolveDate('3 din mein', today)).toBe('2026-11-25');
    expect(resolveDate('agle hafte', today)).toBe('2026-11-29');
    expect(resolveDate('10 dec', today)).toBe('2026-12-10');
  });
  it('no date word -> null, and words inside other words do not count', () => {
    expect(resolveDate('Ramesh ko 500 dena hai', today)).toBeNull();
    expect(resolveDate('kalpana ka udhaar', today)).toBeNull();
    expect(resolveDate('निकला', today)).toBeNull();
    expect(hasDateWord('Maggi khatam')).toBe(false);
  });
  it('addDaysIso crosses month and year', () => {
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01');
  });
});
