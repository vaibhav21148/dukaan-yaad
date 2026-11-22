// "Example se try karo": a sample note with a PRE-COMPUTED result, plus a small sample ledger.
// Makes zero API calls. Everything is flagged demo:true so "Demo data hatao" removes only this.
import { addDaysIso, resolveDate } from '../../shared/dates';
import type { Entry, ExtractedEntry, Lang, Note, Party } from '../../shared/types';
import { db, type DukaanDb } from '../db/db';

interface DemoNote {
  text: string;
  entries: Omit<ExtractedEntry, 'due'>[];
}

// Pre-computed extraction for each language's sample note. Dates are resolved from the quote at load time.
export const DEMO_NOTES: Record<Lang, DemoNote> = {
  hi: {
    text: 'Ramesh distributor ko 5000 dena hai Friday tak, Parle-G aur Maggi khatam, Sharma ka 200 udhaar, Gupta ji ka order kal shaam 2 kilo chawal, Verma ji ne 150 de diye, nahi 250 the',
    entries: [
      { type: 'supplier_due', party: 'Ramesh distributor', amount: 5000, item: null, unclear: null, quote: 'Ramesh distributor ko 5000 dena hai Friday tak' },
      { type: 'reorder', party: null, amount: null, item: 'Parle-G', unclear: null, quote: 'Parle-G aur Maggi khatam' },
      { type: 'reorder', party: null, amount: null, item: 'Maggi', unclear: null, quote: 'Parle-G aur Maggi khatam' },
      { type: 'credit_given', party: 'Sharma', amount: 200, item: null, unclear: null, quote: 'Sharma ka 200 udhaar' },
      { type: 'pending_order', party: 'Gupta ji', amount: null, item: '2 kilo chawal', unclear: null, quote: 'Gupta ji ka order kal shaam 2 kilo chawal' },
      { type: 'credit_received', party: 'Verma ji', amount: 250, item: null, unclear: null, quote: 'Verma ji ne 150 de diye, nahi 250 the' },
    ],
  },
  en: {
    text: 'Owe Ramesh distributor 5000 by Friday, Parle-G and Maggi finished, Sharma took 200 on credit, Gupta ji order tomorrow 2 kilo rice, Verma ji paid back 150, no 250',
    entries: [
      { type: 'supplier_due', party: 'Ramesh distributor', amount: 5000, item: null, unclear: null, quote: 'Owe Ramesh distributor 5000 by Friday' },
      { type: 'reorder', party: null, amount: null, item: 'Parle-G', unclear: null, quote: 'Parle-G and Maggi finished' },
      { type: 'reorder', party: null, amount: null, item: 'Maggi', unclear: null, quote: 'Parle-G and Maggi finished' },
      { type: 'credit_given', party: 'Sharma', amount: 200, item: null, unclear: null, quote: 'Sharma took 200 on credit' },
      { type: 'pending_order', party: 'Gupta ji', amount: null, item: '2 kilo rice', unclear: null, quote: 'Gupta ji order tomorrow 2 kilo rice' },
      { type: 'credit_received', party: 'Verma ji', amount: 250, item: null, unclear: null, quote: 'Verma ji paid back 150, no 250' },
    ],
  },
  mr: {
    text: 'रमेश डिस्ट्रीब्यूटरला 5000 द्यायचे आहेत शुक्रवारपर्यंत, पारले-जी आणि मॅगी संपले, शर्मा यांचे 200 उधार, गुप्ता यांची ऑर्डर उद्या 2 किलो तांदूळ, वर्मा यांनी 150 परत दिले, नाही 250 होते',
    entries: [
      { type: 'supplier_due', party: 'रमेश डिस्ट्रीब्यूटर', amount: 5000, item: null, unclear: null, quote: 'रमेश डिस्ट्रीब्यूटरला 5000 द्यायचे आहेत शुक्रवारपर्यंत' },
      { type: 'reorder', party: null, amount: null, item: 'पारले-जी', unclear: null, quote: 'पारले-जी आणि मॅगी संपले' },
      { type: 'reorder', party: null, amount: null, item: 'मॅगी', unclear: null, quote: 'पारले-जी आणि मॅगी संपले' },
      { type: 'credit_given', party: 'शर्मा', amount: 200, item: null, unclear: null, quote: 'शर्मा यांचे 200 उधार' },
      { type: 'pending_order', party: 'गुप्ता', amount: null, item: '2 किलो तांदूळ', unclear: null, quote: 'गुप्ता यांची ऑर्डर उद्या 2 किलो तांदूळ' },
      { type: 'credit_received', party: 'वर्मा', amount: 250, item: null, unclear: null, quote: 'वर्मा यांनी 150 परत दिले, नाही 250 होते' },
    ],
  },
  gu: {
    text: 'રમેશ ડિસ્ટ્રીબ્યુટરને 5000 આપવાના છે શુક્રવાર સુધી, પારલે-જી અને મેગી ખતમ, શર્માનું 200 ઉધાર, ગુપ્તાજીનો ઓર્ડર કાલે 2 કિલો ચોખા, વર્માજીએ 150 પાછા આપ્યા, ના 250 હતા',
    entries: [
      { type: 'supplier_due', party: 'રમેશ ડિસ્ટ્રીબ્યુટર', amount: 5000, item: null, unclear: null, quote: 'રમેશ ડિસ્ટ્રીબ્યુટરને 5000 આપવાના છે શુક્રવાર સુધી' },
      { type: 'reorder', party: null, amount: null, item: 'પારલે-જી', unclear: null, quote: 'પારલે-જી અને મેગી ખતમ' },
      { type: 'reorder', party: null, amount: null, item: 'મેગી', unclear: null, quote: 'પારલે-જી અને મેગી ખતમ' },
      { type: 'credit_given', party: 'શર્મા', amount: 200, item: null, unclear: null, quote: 'શર્માનું 200 ઉધાર' },
      { type: 'pending_order', party: 'ગુપ્તાજી', amount: null, item: '2 કિલો ચોખા', unclear: null, quote: 'ગુપ્તાજીનો ઓર્ડર કાલે 2 કિલો ચોખા' },
      { type: 'credit_received', party: 'વર્માજી', amount: 250, item: null, unclear: null, quote: 'વર્માજીએ 150 પાછા આપ્યા, ના 250 હતા' },
    ],
  },
};

export function demoExtraction(lang: Lang, today: string): { text: string; entries: ExtractedEntry[] } {
  const n = DEMO_NOTES[lang] ?? DEMO_NOTES.hi;
  return {
    text: n.text,
    entries: n.entries.map((e) => ({
      ...e,
      due: e.type === 'supplier_due' || e.type === 'pending_order' ? resolveDate(e.quote, today) : null,
    })),
  };
}

// Sample ledger. Two "Sharma"s on purpose, so the sample note shows the "Kaun se Sharma?" question.
const NAMES: Record<Lang, { ramesh: string; gupta: string; sharmaJi: string; sharmaUncle: string; verma: string; salt: string; oil: string; agarwal: string; meena: string; meenaOrder: string }> = {
  hi: { ramesh: 'Ramesh distributor', gupta: 'Gupta Traders', sharmaJi: 'Sharma ji', sharmaUncle: 'Sharma uncle', verma: 'Verma ji', salt: 'Tata namak', oil: 'Fortune tel', agarwal: 'Agarwal agency', meena: 'Meena didi', meenaOrder: '5 kilo atta' },
  en: { ramesh: 'Ramesh distributor', gupta: 'Gupta Traders', sharmaJi: 'Sharma ji', sharmaUncle: 'Sharma uncle', verma: 'Verma ji', salt: 'Tata salt', oil: 'Fortune oil', agarwal: 'Agarwal agency', meena: 'Meena didi', meenaOrder: '5 kilo atta' },
  mr: { ramesh: 'रमेश डिस्ट्रीब्यूटर', gupta: 'गुप्ता ट्रेडर्स', sharmaJi: 'शर्मा काका', sharmaUncle: 'शर्मा भाऊ', verma: 'वर्मा', salt: 'टाटा मीठ', oil: 'फॉर्च्यून तेल', agarwal: 'अग्रवाल एजन्सी', meena: 'मीना ताई', meenaOrder: '5 किलो पीठ' },
  gu: { ramesh: 'રમેશ ડિસ્ટ્રીબ્યુટર', gupta: 'ગુપ્તા ટ્રેડર્સ', sharmaJi: 'શર્મા કાકા', sharmaUncle: 'શર્મા ભાઈ', verma: 'વર્માજી', salt: 'ટાટા મીઠું', oil: 'ફોર્ચ્યુન તેલ', agarwal: 'અગ્રવાલ એજન્સી', meena: 'મીના બેન', meenaOrder: '5 કિલો લોટ' },
};

export async function loadDemoLedger(lang: Lang, today: string, d: DukaanDb = db): Promise<void> {
  const N = NAMES[lang] ?? NAMES.hi;
  const ago = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
  const mk = (name: string): Party => ({ id: `demo-p-${name}`, name, aliases: [], createdAt: ago(9), demo: true });
  const parties = [N.ramesh, N.gupta, N.sharmaJi, N.sharmaUncle, N.verma, N.agarwal, N.meena].map(mk);
  const pid = (name: string) => `demo-p-${name}`;
  const noteId = 'demo-n-1';
  let i = 0;
  const e = (x: Partial<Entry> & Pick<Entry, 'type'>, daysAgo: number): Entry => ({
    id: `demo-e-${i++}`,
    noteId,
    partyId: null,
    party: null,
    amount: null,
    item: null,
    due: null,
    quote: '',
    status: 'open',
    createdAt: ago(daysAgo),
    source: 'demo',
    demo: true,
    ...x,
  });
  const entries: Entry[] = [
    e({ type: 'supplier_due', partyId: pid(N.ramesh), party: N.ramesh, amount: 3200, due: addDaysIso(today, -2), quote: `${N.ramesh} 3200` }, 6),
    e({ type: 'supplier_due', partyId: pid(N.gupta), party: N.gupta, amount: 1800, due: addDaysIso(today, 1), quote: `${N.gupta} 1800` }, 4),
    e({ type: 'supplier_due', partyId: pid(N.agarwal), party: N.agarwal, amount: 6000, due: addDaysIso(today, 6), quote: `${N.agarwal} 6000` }, 3),
    e({ type: 'supplier_paid', partyId: pid(N.agarwal), party: N.agarwal, amount: 2000, quote: `${N.agarwal} 2000` }, 1),
    e({ type: 'credit_given', partyId: pid(N.sharmaJi), party: N.sharmaJi, amount: 450, quote: `${N.sharmaJi} 450` }, 5),
    e({ type: 'credit_given', partyId: pid(N.sharmaUncle), party: N.sharmaUncle, amount: 120, quote: `${N.sharmaUncle} 120` }, 3),
    e({ type: 'credit_given', partyId: pid(N.verma), party: N.verma, amount: 600, quote: `${N.verma} 600` }, 7),
    e({ type: 'credit_given', partyId: pid(N.meena), party: N.meena, amount: 340, quote: `${N.meena} 340` }, 2),
    e({ type: 'reorder', partyId: pid(N.gupta), party: N.gupta, item: N.salt, quote: N.salt }, 2),
    e({ type: 'reorder', item: N.oil, quote: N.oil }, 1),
    e({ type: 'pending_order', partyId: pid(N.meena), party: N.meena, item: N.meenaOrder, due: addDaysIso(today, 1), quote: `${N.meena} ${N.meenaOrder}` }, 1),
  ];
  const note: Note = { id: noteId, text: DEMO_LEDGER_NOTE[lang] ?? DEMO_LEDGER_NOTE.hi, createdAt: ago(1), entryIds: entries.map((x) => x.id), by: 'demo', stt: null, lang, demo: true };
  await d.transaction('rw', d.entries, d.parties, d.notes, async () => {
    await d.parties.bulkPut(parties);
    await d.entries.bulkPut(entries);
    await d.notes.put(note);
  });
}

const DEMO_LEDGER_NOTE: Record<Lang, string> = {
  hi: '(Example hisaab) Pichhle hafte ke notes',
  en: '(Example data) Notes from last week',
  mr: '(उदाहरण हिशोब) मागील आठवड्याच्या नोंदी',
  gu: '(ઉદાહરણ હિસાબ) ગયા અઠવાડિયાની નોંધો',
};
