import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Entry, Party } from '../../shared/types';
import { answerIsGrounded } from '../../src/ask';
import { answerLocal } from '../../src/ask/local';
import { DukaanDb } from '../../src/db/db';
import { markDone, markPaid, saveNote } from '../../src/db/repo';
import { toDrafts } from '../../src/domain/drafts';
import { customerCredit, groupBySupplier, kalKaKaam, openReorders, snapshot, supplierDues } from '../../src/domain/ledger';
import { collapseRepeats, cleanTranscript } from '../../src/stt/guards';
import { hasSpeech, splitChunks, trimSilence } from '../../src/stt/vad';

const today = '2026-11-22';
let n = 0;
const E = (x: Partial<Entry> & Pick<Entry, 'type'>): Entry => ({ id: `e${n++}`, noteId: null, partyId: null, party: null, amount: null, item: null, due: null, quote: '', status: 'open', createdAt: '2026-11-20T10:00:00Z', source: 'note', ...x });
const parties: Party[] = [
  { id: 'r', name: 'Ramesh distributor', aliases: [], createdAt: '' },
  { id: 's', name: 'Sharma ji', aliases: ['Sharma uncle'], createdAt: '' },
  { id: 'g', name: 'Gupta Traders', aliases: [], createdAt: '' },
];
const entries: Entry[] = [
  E({ type: 'supplier_due', partyId: 'r', party: 'Ramesh', amount: 5000, due: '2026-11-23' }),
  E({ type: 'supplier_due', partyId: 'r', party: 'Ramesh', amount: 1000, due: '2026-11-20' }),
  E({ type: 'supplier_paid', partyId: 'r', party: 'Ramesh', amount: 2000 }),
  E({ type: 'supplier_due', partyId: 'g', party: 'Gupta Traders', amount: 800, due: '2026-12-10' }),
  E({ type: 'credit_given', partyId: 's', party: 'Sharma ji', amount: 300 }),
  E({ type: 'credit_given', partyId: 's', party: 'Sharma uncle', amount: 200 }),
  E({ type: 'credit_received', partyId: 's', party: 'Sharma ji', amount: 100 }),
  E({ type: 'reorder', partyId: 'g', party: 'Gupta Traders', item: 'Tata namak' }),
  E({ type: 'reorder', item: 'tata namak' }),
  E({ type: 'reorder', item: 'Maggi', status: 'done' }),
  E({ type: 'pending_order', party: 'Meena', item: '5 kilo atta', due: '2026-11-23' }),
];

describe('ledger math', () => {
  it('supplier balance = dues - payments, earliest due', () => {
    const s = supplierDues(entries, parties);
    expect(s[0]).toMatchObject({ name: 'Ramesh distributor', bal: 4000, due: '2026-11-20' });
    expect(s[1]).toMatchObject({ name: 'Gupta Traders', bal: 800 });
  });
  it('customer credit merges aliases via party id', () => {
    expect(customerCredit(entries, parties)).toEqual([expect.objectContaining({ name: 'Sharma ji', bal: 400 })]);
  });
  it('reorder dedupes items, remembers the supplier, hides done', () => {
    const r = openReorders(entries, parties);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ supplier: 'Gupta Traders' });
    expect(r[0].ids).toHaveLength(2);
    expect(groupBySupplier(r)[0].supplier).toBe('Gupta Traders');
  });
  it('kal ka kaam: dues by tomorrow incl. overdue, totals', () => {
    const k = kalKaKaam(entries, parties, today);
    expect(k.pay.map((x) => x.name)).toEqual(['Ramesh distributor']);
    expect(k.orders).toHaveLength(1);
    expect(k.dena).toBe(4800);
    expect(k.milna).toBe(400);
  });
});

describe('local Ask answers only from saved data', () => {
  const s = snapshot(entries, parties, today);
  it('a named party', () => {
    expect(answerLocal('Sharma ji ka kitna baaki hai?', s, 'hi')).toBe('Sharma ji ka ₹400 udhaar baaki hai.');
    expect(answerLocal('Ramesh ko kitna dena hai', s, 'hi')).toContain('₹4,000');
  });
  it('topics', () => {
    expect(answerLocal('kya khatam hai?', s, 'hi')).toContain('Tata namak');
    expect(answerLocal('kal kisko dena hai?', s, 'hi')).toContain('Ramesh distributor');
    expect(answerLocal('customers se kitna milna hai', s, 'hi')).toContain('₹400');
    expect(answerLocal('How much do I owe suppliers?', s, 'en')).toContain('₹4,800');
  });
  it('unknown -> says so, no guess', () => {
    expect(answerLocal('Kulkarni ka kitna?', s, 'hi')).toMatch(/nahi mila/);
  });
  it('grounding check rejects invented numbers in AI answers', () => {
    expect(answerIsGrounded('Sharma ji ka ₹400 baaki hai.', s)).toBe(true);
    expect(answerIsGrounded('Sharma ji ka ₹750 baaki hai.', s)).toBe(false);
    expect(answerIsGrounded('Total ₹4,800.', s)).toBe(true);
  });
});

describe('save, alias learning and undo (IndexedDB)', () => {
  let db: DukaanDb;
  beforeEach(async () => {
    db = new DukaanDb('test-' + Math.random());
    await db.parties.add({ id: 's', name: 'Sharma ji', aliases: [], createdAt: '' });
  });
  it('saves entries, links "Sharma uncle" to Sharma ji as an alias, and undo restores everything', async () => {
    const ps = await db.parties.toArray();
    const drafts = toDrafts(
      [
        { type: 'credit_given', party: 'Sharma uncle', amount: 200, item: null, due: null, unclear: null, quote: 'Sharma uncle ka 200 udhaar' },
        { type: 'supplier_due', party: 'Ramesh', amount: 500, item: null, due: null, unclear: null, quote: 'Ramesh ko 500 dena' },
      ],
      'Sharma uncle ka 200 udhaar, Ramesh ko 500 dena',
      ps,
      'hi',
    );
    expect(drafts[0].partyId).toBe('s');
    const u = await saveNote({ text: 'x', entries: drafts, by: 'offline', stt: null, lang: 'hi' }, db);
    expect(await db.entries.count()).toBe(2);
    expect((await db.parties.get('s'))!.aliases).toEqual(['Sharma uncle']);
    expect(await db.parties.count()).toBe(2);
    await u.revert();
    expect(await db.entries.count()).toBe(0);
    expect(await db.notes.count()).toBe(0);
    expect(await db.parties.count()).toBe(1);
    expect((await db.parties.get('s'))!.aliases).toEqual([]);
  });
  it('Paid and Mangwa liya are undoable', async () => {
    await db.entries.add(E({ id: 'd1', type: 'supplier_due', partyId: 's', amount: 900 }));
    await db.entries.add(E({ id: 'r1', type: 'reorder', item: 'Maggi' }));
    const b = supplierDues(await db.entries.toArray(), await db.parties.toArray())[0];
    const u1 = await markPaid(b, db);
    expect(supplierDues(await db.entries.toArray(), [])).toEqual([]);
    await u1.revert();
    expect(supplierDues(await db.entries.toArray(), [])[0].bal).toBe(900);
    const u2 = await markDone(['r1'], db);
    expect((await db.entries.get('r1'))!.status).toBe('done');
    await u2.revert();
    expect((await db.entries.get('r1'))!.status).toBe('open');
  });
});

describe('STT guards and VAD', () => {
  it('drops Whisper hallucinations', () => {
    expect(cleanTranscript('Thank you for watching!')).toBe('');
    expect(cleanTranscript('धन्यवाद')).toBe('');
    expect(cleanTranscript('[Music]')).toBe('');
    expect(cleanTranscript('Ramesh ko 500 dena hai', 0.01)).toBe('');
  });
  it('collapses repeated phrases', () => {
    expect(collapseRepeats('Maggi khatam Maggi khatam Maggi khatam Maggi khatam')).toBe('Maggi khatam');
    expect(collapseRepeats('ek do ek do')).toBe('ek do ek do');
  });
  const tone = (sec: number, amp: number) => Float32Array.from({ length: sec * 16000 }, (_, i) => amp * Math.sin(i / 5));
  const silence = (sec: number) => new Float32Array(sec * 16000);
  it('silence has no speech; trimming removes it', () => {
    expect(hasSpeech(silence(3))).toBe(false);
    const a = new Float32Array([...silence(2), ...tone(1, 0.3), ...silence(2)]);
    expect(hasSpeech(a)).toBe(true);
    const trimmed = trimSilence(a).length; // 1 s speech + 2x250 ms padding + 300 ms VAD hangover
    expect(trimmed).toBeGreaterThan(16000);
    expect(trimmed).toBeLessThan(2 * 16000);
  });
  it('splits long audio into chunks under 30 s', () => {
    const a = tone(70, 0.2);
    const chunks = splitChunks(a, 28);
    expect(chunks.every((c) => c.length <= 28 * 16000)).toBe(true);
    expect(chunks.reduce((s, c) => s + c.length, 0)).toBe(a.length);
  });
});
