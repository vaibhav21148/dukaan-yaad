import { describe, expect, it } from 'vitest';
import { neverInvent } from '../../shared/guard';
import { matchParty, nameCore } from '../../shared/names';
import { phoneticKey, toRoman } from '../../shared/translit';
import { parseOffline, pickAmount } from '../../src/extract/offline/parser';

const ctx = { today: '2026-11-22', lang: 'hi' as const, parties: [] };
const p = (t: string, c: Partial<typeof ctx> = {}) => parseOffline(t, { ...ctx, ...c } as never);
const pick = (e: ReturnType<typeof p>[number]) => ({ type: e.type, party: e.party, amount: e.amount, item: e.item, due: e.due });

describe('offline parser: the prototype example', () => {
  const out = p('Ramesh distributor ko 5000 dena hai Friday tak, Parle-G aur Maggi khatam, Sharma ji ka 200 udhaar, Gupta ji ka order kal shaam 2 kilo chawal, Verma ji ne 150 de diye');
  it('finds all six entries with the right fields', () => {
    expect(out.map(pick)).toEqual([
      { type: 'supplier_due', party: 'Ramesh distributor', amount: 5000, item: null, due: '2026-11-27' },
      { type: 'reorder', party: null, amount: null, item: 'Parle-G', due: null },
      { type: 'reorder', party: null, amount: null, item: 'Maggi', due: null },
      { type: 'credit_given', party: 'Sharma ji', amount: 200, item: null, due: null },
      { type: 'pending_order', party: 'Gupta ji', amount: null, item: '2 kilo chawal', due: '2026-11-23' },
      { type: 'credit_received', party: 'Verma ji', amount: 150, item: null, due: null },
    ]);
  });
  it('keeps the exact quote', () => {
    expect(out[0].quote).toBe('Ramesh distributor ko 5000 dena hai Friday tak');
    expect(out[1].quote).toBe('Parle-G aur Maggi khatam');
  });
});

describe('offline parser: corrections, multi-entry, numbers', () => {
  it('"nahi, 300 tha" uses the corrected value', () => {
    const [e] = p('Sharma ji ka 200 udhaar, nahi 300 tha');
    expect(e.amount).toBe(300);
    expect(e.quote).toContain('nahi 300 tha');
  });
  it('inline correction "500 nahi 700"', () => expect(p('Ramesh ko 500 nahi 700 dena hai')[0].amount).toBe(700));
  it('two credits in one sentence', () => {
    expect(p('Sharma ji ka 200 aur Verma ji ka 300 udhaar').map((e) => [e.party, e.amount])).toEqual([
      ['Sharma ji', 200],
      ['Verma ji', 300],
    ]);
  });
  it('number words', () => expect(p('Mohan ko teen sau pachas de diye')[0]).toMatchObject({ type: 'supplier_paid', amount: 350 }));
  it('dedh hazaar baaki', () => expect(p('Kiran ka dedh hazaar baaki hai')[0]).toMatchObject({ type: 'credit_given', amount: 1500 }));
  it('supplier named in a reorder', () => {
    const out = p('Ramesh distributor se Maggi aur Surf mangwana hai');
    expect(out.map((e) => [e.type, e.party, e.item])).toEqual([
      ['reorder', 'Ramesh distributor', 'Maggi'],
      ['reorder', 'Ramesh distributor', 'Surf'],
    ]);
  });
  it('quantity is not the amount', () => {
    const [e] = p('Gupta ji 2 packet doodh le gaye 120 ka');
    expect(e).toMatchObject({ type: 'credit_given', party: 'Gupta ji', amount: 120 });
  });
  it('udhaar with a supplier means the shop owes the supplier', () => {
    expect(p('Ramesh distributor ka 5000 udhaar hai')[0].type).toBe('supplier_due');
  });
  it('lena hai = customer owes', () => expect(p('Sharma ji se 400 lena hai')[0]).toMatchObject({ type: 'credit_given', amount: 400 }));
  it('pickAmount skips day numbers and quantities', () => {
    expect(pickAmount('25 tarikh tak 500 dena')).toBe(500);
    expect(pickAmount('2 kilo chawal')).toBeNull();
    expect(pickAmount('₹ 300')).toBe(300);
  });
});

describe('offline parser: never invents', () => {
  it('missing amount -> null + question', () => {
    const [e] = p('Ramesh ko payment dena hai');
    expect(e.amount).toBeNull();
    expect(e.unclear).toBeTruthy();
  });
  it('missing name -> null + question', () => {
    const [e] = p('500 udhaar diya');
    expect(e.party).toBeNull();
    expect(e.unclear).toBeTruthy();
  });
  it('noise produces no entries', () => {
    expect(p('haan theek hai')).toEqual([]);
    expect(p('')).toEqual([]);
  });
  it('unknown clause with a number becomes a yellow card, not a guess', () => {
    const [e] = p('Ramesh 500');
    expect(e.unclear).toBeTruthy();
  });
});

describe('offline parser: other languages', () => {
  it('Hindi Devanagari', () => {
    expect(pick(p('रमेश को पाँच सौ देना है शुक्रवार तक')[0])).toEqual({ type: 'supplier_due', party: 'रमेश', amount: 500, item: null, due: '2026-11-27' });
    expect(p('शर्मा जी ने 200 दिए')[0]).toMatchObject({ type: 'credit_received', party: 'शर्मा जी', amount: 200 });
  });
  it('Marathi with glued suffixes', () => {
    expect(pick(p('रमेशला 5000 द्यायचे आहेत शुक्रवारपर्यंत', { lang: 'mr' })[0])).toEqual({ type: 'supplier_due', party: 'रमेश', amount: 5000, item: null, due: '2026-11-27' });
    expect(p('शर्मा काकांनी 200 परत दिले', { lang: 'mr' })[0]).toMatchObject({ type: 'credit_received', amount: 200 });
    expect(p('साखर आणि तेल संपले', { lang: 'mr' }).map((e) => e.item)).toEqual(['साखर', 'तेल']);
    expect(p('पाटील यांचे 300 उधार', { lang: 'mr' })[0]).toMatchObject({ type: 'credit_given', party: 'पाटील', amount: 300 });
  });
  it('Gujarati', () => {
    expect(p('રમેશભાઈને 5000 આપવાના છે શુક્રવાર સુધી', { lang: 'gu' })[0]).toMatchObject({ type: 'supplier_due', party: 'રમેશભાઈ', amount: 5000, due: '2026-11-27' });
    expect(p('ખાંડ અને તેલ ખતમ', { lang: 'gu' }).map((e) => e.item)).toEqual(['ખાંડ', 'તેલ']);
    expect(p('પટેલ ભાઈ 200 ઉધાર લઈ ગયા', { lang: 'gu' })[0]).toMatchObject({ type: 'credit_given', party: 'પટેલ ભાઈ', amount: 200 });
  });
  it('English', () => {
    expect(p('Paid Ramesh 2000', { lang: 'en' })[0]).toMatchObject({ type: 'supplier_paid', party: 'Ramesh', amount: 2000 });
    expect(p('Sharma paid back 300', { lang: 'en' })[0]).toMatchObject({ type: 'credit_received', party: 'Sharma', amount: 300 });
    expect(p('Owe Ramesh 5000 by Friday', { lang: 'en' })[0]).toMatchObject({ type: 'supplier_due', amount: 5000, due: '2026-11-27' });
    expect(p('Gupta took 200 on credit', { lang: 'en' })[0]).toMatchObject({ type: 'credit_given', party: 'Gupta', amount: 200 });
  });
});

describe('party matching', () => {
  const parties = [
    { id: '1', name: 'Sharma ji', aliases: [] },
    { id: '2', name: 'Sharma uncle', aliases: [] },
    { id: '3', name: 'Ramesh distributor', aliases: ['Ramesh bhai'] },
  ];
  it('strips honorifics', () => {
    expect(nameCore('Sharma uncle')).toBe('sharma');
    expect(nameCore('Ramesh distributor')).toBe('ramesh');
    expect(nameCore('रमेश भाई')).toBe('रमेश');
  });
  it('exact name wins even when two Sharmas exist', () => {
    const m = matchParty('Sharma ji', parties);
    expect(m.kind).toBe('exact');
  });
  it('bare "Sharma" is ambiguous between two parties', () => {
    const m = matchParty('Sharma', parties);
    expect(m.kind).toBe('many');
    if (m.kind === 'many') expect(m.parties.map((x) => x.id).sort()).toEqual(['1', '2']);
  });
  it('"Sharma uncle" maps to "Sharma ji" when only one Sharma exists', () => {
    const m = matchParty('Sharma uncle', [parties[0]]);
    expect(m.kind).toBe('one');
  });
  it('alias and cross-script matching', () => {
    expect(matchParty('Ramesh', parties)).toMatchObject({ kind: 'one' });
    expect(matchParty('रमेश', parties)).toMatchObject({ kind: 'one' });
    expect(toRoman('शर्मा')).toBe('sharmaa');
    expect(phoneticKey('शर्मा')).toBe(phoneticKey('Sharma'));
  });
  it('unknown name -> none', () => expect(matchParty('Kulkarni', parties).kind).toBe('none'));
});

describe('never-invent guard (used for the AI path)', () => {
  const t = 'Ramesh ko paanch sau dena hai Friday tak, Maggi khatam';
  it('keeps values that were spoken', () => {
    const { entries, nulled } = neverInvent([{ type: 'supplier_due', party: 'Ramesh', amount: 500, item: null, due: '2026-11-27', unclear: null, quote: '' }], t, 'hi');
    expect(nulled).toEqual([]);
    expect(entries[0].amount).toBe(500);
  });
  it('nulls an invented amount, name, item and date and asks', () => {
    const { entries, nulled } = neverInvent(
      [
        { type: 'supplier_due', party: 'Suresh', amount: 5000, item: null, due: null, unclear: null, quote: '' },
        { type: 'reorder', party: null, amount: null, item: 'Surf', due: null, unclear: null, quote: '' },
        { type: 'credit_given', party: 'Ramesh', amount: 500, item: null, due: '2026-12-01', unclear: null, quote: '' },
      ],
      'Ramesh ko paanch sau dena hai, Maggi khatam',
      'hi',
    );
    expect(nulled.map((n) => n.field)).toEqual(['amount', 'party', 'item', 'due']);
    expect(entries.every((e) => e.unclear)).toBe(true);
  });
  it('accepts a known name spoken in another script', () => {
    const { nulled } = neverInvent([{ type: 'credit_given', party: 'Sharma ji', amount: 200, item: null, due: null, unclear: null, quote: '' }], 'शर्मा जी का 200 उधार', 'hi');
    expect(nulled).toEqual([]);
  });
});
