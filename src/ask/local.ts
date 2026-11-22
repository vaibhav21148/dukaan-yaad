// Offline "Poochho": answers ONLY from the saved ledger snapshot. No guessing.
import { containsWord } from '../../shared/dates';
import { cleanName, nameInText } from '../../shared/names';
import { toRoman } from '../../shared/translit';
import { addDaysIso } from '../../shared/dates';
import type { Lang, LedgerSnapshot } from '../../shared/types';

export const rs = (n: number) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');

type T = {
  supOwe: (n: string, a: string, d: string) => string;
  cusOwe: (n: string, a: string) => string;
  order: (n: string, item: string, d: string) => string;
  nothingFor: (n: string) => string;
  totalDena: (a: string, c: number) => string;
  totalMilna: (a: string, c: number) => string;
  reorder: (items: string) => string;
  reorderNone: string;
  orders: (list: string) => string;
  ordersNone: string;
  payBy: (list: string) => string;
  payNone: string;
  late: (list: string) => string;
  lateNone: string;
  notFound: string;
  due: (d: string) => string;
  today: string;
  tomorrow: string;
  late1: string;
};

const fmt = (iso: string | null, today: string, t: T) => {
  if (!iso) return '';
  if (iso < today) return t.late1;
  if (iso === today) return t.today;
  if (iso === addDaysIso(today, 1)) return t.tomorrow;
  return new Date(iso + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const TEXT: Record<Lang, T> = {
  hi: {
    supOwe: (n, a, d) => `${n} ko ${a} dena hai${d ? ` (${d})` : ''}.`,
    cusOwe: (n, a) => `${n} ka ${a} udhaar baaki hai.`,
    order: (n, item, d) => `${n} ka order${item ? `: ${item}` : ''}${d ? ` (${d})` : ''}.`,
    nothingFor: (n) => `${n} ka koi baaki hisaab nahi hai.`,
    totalDena: (a, c) => `Suppliers ko kul ${a} dena hai (${c} log).`,
    totalMilna: (a, c) => `Customers se kul ${a} milna hai (${c} log).`,
    reorder: (i) => `Mangwana hai: ${i}.`,
    reorderNone: 'Kuch khatam nahi likha hai.',
    orders: (l) => `Baaki orders: ${l}.`,
    ordersNone: 'Koi order baaki nahi.',
    payBy: (l) => `Kal tak dena hai: ${l}.`,
    payNone: 'Kal tak koi supplier payment nahi.',
    late: (l) => `Der ho gayi: ${l}.`,
    lateNone: 'Koi payment late nahi hai.',
    notFound: 'Yeh saved hisaab mein nahi mila. Naam waise hi bolo jaise save kiya tha.',
    due: (d) => d,
    today: 'aaj',
    tomorrow: 'kal',
    late1: 'der ho gayi',
  },
  en: {
    supOwe: (n, a, d) => `You owe ${n} ${a}${d ? ` (${d})` : ''}.`,
    cusOwe: (n, a) => `${n} owes you ${a}.`,
    order: (n, item, d) => `${n}'s order${item ? `: ${item}` : ''}${d ? ` (${d})` : ''}.`,
    nothingFor: (n) => `Nothing pending for ${n}.`,
    totalDena: (a, c) => `You owe suppliers ${a} in total (${c}).`,
    totalMilna: (a, c) => `Customers owe you ${a} in total (${c}).`,
    reorder: (i) => `To reorder: ${i}.`,
    reorderNone: 'Nothing marked as out of stock.',
    orders: (l) => `Pending orders: ${l}.`,
    ordersNone: 'No pending orders.',
    payBy: (l) => `Due by tomorrow: ${l}.`,
    payNone: 'No supplier payment due by tomorrow.',
    late: (l) => `Overdue: ${l}.`,
    lateNone: 'No payment is overdue.',
    notFound: "Not found in your saved records. Say the name the way it was saved.",
    due: (d) => d,
    today: 'today',
    tomorrow: 'tomorrow',
    late1: 'overdue',
  },
  mr: {
    supOwe: (n, a, d) => `${n} यांना ${a} द्यायचे आहेत${d ? ` (${d})` : ''}.`,
    cusOwe: (n, a) => `${n} यांचे ${a} उधार बाकी आहे.`,
    order: (n, item, d) => `${n} यांची ऑर्डर${item ? `: ${item}` : ''}${d ? ` (${d})` : ''}.`,
    nothingFor: (n) => `${n} यांचा कोणताही हिशोब बाकी नाही.`,
    totalDena: (a, c) => `पुरवठादारांना एकूण ${a} द्यायचे आहेत (${c}).`,
    totalMilna: (a, c) => `ग्राहकांकडून एकूण ${a} येणे आहे (${c}).`,
    reorder: (i) => `मागवायचे: ${i}.`,
    reorderNone: 'काहीही संपलेले नोंदवलेले नाही.',
    orders: (l) => `बाकी ऑर्डर: ${l}.`,
    ordersNone: 'कोणतीही ऑर्डर बाकी नाही.',
    payBy: (l) => `उद्यापर्यंत द्यायचे: ${l}.`,
    payNone: 'उद्यापर्यंत कोणतेही पेमेंट नाही.',
    late: (l) => `उशीर झाला: ${l}.`,
    lateNone: 'कोणतेही पेमेंट उशिरा नाही.',
    notFound: 'हे जतन केलेल्या हिशोबात सापडले नाही. नाव जसे जतन केले तसे बोला.',
    due: (d) => d,
    today: 'आज',
    tomorrow: 'उद्या',
    late1: 'उशीर',
  },
  gu: {
    supOwe: (n, a, d) => `${n} ને ${a} આપવાના છે${d ? ` (${d})` : ''}.`,
    cusOwe: (n, a) => `${n} નું ${a} ઉધાર બાકી છે.`,
    order: (n, item, d) => `${n} નો ઓર્ડર${item ? `: ${item}` : ''}${d ? ` (${d})` : ''}.`,
    nothingFor: (n) => `${n} નો કોઈ હિસાબ બાકી નથી.`,
    totalDena: (a, c) => `સપ્લાયરને કુલ ${a} આપવાના છે (${c}).`,
    totalMilna: (a, c) => `ગ્રાહકો પાસેથી કુલ ${a} લેવાના છે (${c}).`,
    reorder: (i) => `મંગાવવાનું: ${i}.`,
    reorderNone: 'કંઈ ખતમ નોંધાયું નથી.',
    orders: (l) => `બાકી ઓર્ડર: ${l}.`,
    ordersNone: 'કોઈ ઓર્ડર બાકી નથી.',
    payBy: (l) => `કાલ સુધી આપવાના: ${l}.`,
    payNone: 'કાલ સુધી કોઈ પેમેન્ટ નથી.',
    late: (l) => `મોડું થયું: ${l}.`,
    lateNone: 'કોઈ પેમેન્ટ મોડું નથી.',
    notFound: 'સાચવેલા હિસાબમાં આ મળ્યું નહીં. નામ જેમ સાચવ્યું હતું તેમ બોલો.',
    due: (d) => d,
    today: 'આજે',
    tomorrow: 'કાલે',
    late1: 'મોડું',
  },
};

// Question-intent keywords (data). Order matters: specific before general.
const Q = {
  late: ['late', 'der', 'overdue', 'pichhla', 'उशीर', 'देर', 'મોડું', 'baaki reh gaya'],
  payBy: ['kal kisko', 'kisko dena', 'kise dena', 'who to pay', 'whom to pay', 'pay tomorrow', 'kal tak', 'किसको देना', 'कोणाला द्यायचे', 'કોને આપવાના', 'payment kab', 'due'],
  reorder: ['run out', 'ran out', 'finished', 'out of', 'low', 'khatam', 'mangwana', 'mangana', 'maal', 'stock', 'reorder', 'out of stock', 'खत्म', 'ख़त्म', 'मंगवाना', 'संपले', 'मागवायचे', 'ખતમ', 'મંગાવવાનું', 'kya lana'],
  orders: ['order', 'orders', 'ऑर्डर', 'ઓર્ડર', 'deliver', 'delivery'],
  totalDena: ['kitna dena', 'total dena', 'kul dena', 'suppliers ko', 'how much do i owe', 'i owe', 'कितना देना', 'किती द्यायचे', 'કેટલા આપવાના', 'supplier'],
  totalMilna: ['kitna milna', 'kul udhaar', 'total udhaar', 'sab ka udhaar', 'customers se', 'owe me', 'how much credit', 'कितना मिलना', 'उधार कितना', 'किती येणे', 'એકંદર ઉધાર', 'કેટલા લેવાના', 'udhaar', 'customer'],
};
const hasAny = (q: string, words: string[]) => words.some((w) => containsWord(q, w) >= 0 || (w.includes(' ') && q.includes(w)));

export function answerLocal(question: string, s: LedgerSnapshot, lang: Lang): string {
  const t = TEXT[lang] ?? TEXT.hi;
  const q = question.toLowerCase();
  const f = (d: string | null) => fmt(d, s.today, t);

  // 1) A named person: answer for that person only.
  const names = new Map<string, string>();
  // keyed by the full saved name: "Sharma ji" and "Sharma uncle" are different people
  for (const x of s.suppliers_owed) names.set(cleanName(x.name), x.name);
  for (const x of s.customers_owe) names.set(cleanName(x.name), x.name);
  for (const o of s.pending_orders) if (o.party) names.set(cleanName(o.party), o.party);
  // If the question says a saved name exactly ("Sharma ji"), answer for that one only;
  // a bare "Sharma" matches every Sharma, and we list them all rather than guess.
  const qClean = ` ${cleanName(toRoman(question))} `;
  const all = [...names.values()];
  const exact = all.filter((n) => qClean.includes(` ${cleanName(toRoman(n))} `));
  const hits = exact.length ? exact : all.filter((n) => nameInText(n, question));
  if (hits.length) {
    const lines: string[] = [];
    for (const n of hits) {
      const key = cleanName(n);
      const before = lines.length;
      for (const x of s.suppliers_owed) if (cleanName(x.name) === key) lines.push(t.supOwe(x.name, rs(x.amount), f(x.due)));
      for (const x of s.customers_owe) if (cleanName(x.name) === key) lines.push(t.cusOwe(x.name, rs(x.amount)));
      for (const o of s.pending_orders) if (o.party && cleanName(o.party) === key) lines.push(t.order(o.party, o.item ?? '', f(o.due)));
      if (lines.length === before) lines.push(t.nothingFor(n));
    }
    return lines.join('\n');
  }
  // 2) Topic questions
  if (hasAny(q, Q.late)) {
    const late = s.suppliers_owed.filter((x) => x.due && x.due < s.today);
    return late.length ? t.late(late.map((x) => `${x.name} ${rs(x.amount)}`).join(', ')) : t.lateNone;
  }
  if (hasAny(q, Q.payBy)) {
    const tmr = addDaysIso(s.today, 1);
    const pay = s.suppliers_owed.filter((x) => x.due && x.due <= tmr);
    return pay.length ? t.payBy(pay.map((x) => `${x.name} ${rs(x.amount)} (${f(x.due)})`).join(', ')) : t.payNone;
  }
  if (hasAny(q, Q.reorder)) {
    return s.to_reorder.length ? t.reorder(s.to_reorder.map((i) => (i.supplier ? `${i.item} (${i.supplier})` : i.item)).join(', ')) : t.reorderNone;
  }
  if (hasAny(q, Q.orders)) {
    return s.pending_orders.length
      ? t.orders(s.pending_orders.map((o) => `${o.party ?? '?'}${o.item ? ': ' + o.item : ''}${o.due ? ' (' + f(o.due) + ')' : ''}`).join('; '))
      : t.ordersNone;
  }
  if (hasAny(q, Q.totalDena)) return t.totalDena(rs(s.suppliers_owed.reduce((a, x) => a + x.amount, 0)), s.suppliers_owed.length);
  if (hasAny(q, Q.totalMilna)) return t.totalMilna(rs(s.customers_owe.reduce((a, x) => a + x.amount, 0)), s.customers_owe.length);
  return t.notFound;
}
