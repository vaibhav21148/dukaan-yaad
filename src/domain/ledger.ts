// Derived views over saved entries. Pure functions: easy to unit test.
import { addDaysIso } from '../../shared/dates';
import { nameCore } from '../../shared/names';
import type { Entry, LedgerSnapshot, Party } from '../../shared/types';

export interface Balance {
  key: string; // partyId, or "name:<core>" when an entry has no party id
  partyId: string | null;
  name: string;
  bal: number;
  due: string | null; // earliest due date among dues (suppliers only)
}

const keyOf = (e: Entry) => e.partyId ?? `name:${nameCore(e.party) || '?'}`;

function balances(entries: Entry[], parties: Party[], plus: Entry['type'], minus: Entry['type']): Balance[] {
  const byId = new Map(parties.map((p) => [p.id, p]));
  const m = new Map<string, Balance>();
  for (const e of entries) {
    if (e.type !== plus && e.type !== minus) continue;
    const k = keyOf(e);
    const name = (e.partyId && byId.get(e.partyId)?.name) || e.party || '?';
    const b = m.get(k) ?? { key: k, partyId: e.partyId, name, bal: 0, due: null };
    const a = Number(e.amount) || 0;
    b.bal += e.type === plus ? a : -a;
    if (e.type === plus && e.due && (!b.due || e.due < b.due)) b.due = e.due;
    m.set(k, b);
  }
  return [...m.values()]
    .map((b) => ({ ...b, bal: Math.round(b.bal * 100) / 100 }))
    .filter((b) => b.bal > 0.5)
    .sort((a, b) => (a.due ?? '9999') .localeCompare(b.due ?? '9999') || b.bal - a.bal);
}

export const supplierDues = (entries: Entry[], parties: Party[]) => balances(entries, parties, 'supplier_due', 'supplier_paid');
export const customerCredit = (entries: Entry[], parties: Party[]) =>
  balances(entries, parties, 'credit_given', 'credit_received').map((b) => ({ ...b, due: null }));

export const total = (list: Balance[]) => list.reduce((s, x) => s + x.bal, 0);

export interface ReorderItem {
  key: string;
  item: string;
  supplier: string | null;
  ids: string[];
}

/** Open reorder items, de-duplicated by item, with the supplier when known. */
export function openReorders(entries: Entry[], parties: Party[]): ReorderItem[] {
  const byId = new Map(parties.map((p) => [p.id, p]));
  // last known supplier per item, from any earlier reorder entry with a party
  const lastSupplier = new Map<string, string>();
  for (const e of entries) {
    if (e.type !== 'reorder' || !e.item) continue;
    const name = (e.partyId && byId.get(e.partyId)?.name) || e.party;
    if (name) lastSupplier.set(nameCore(e.item), name);
  }
  const m = new Map<string, ReorderItem>();
  for (const e of entries) {
    if (e.type !== 'reorder' || e.status === 'done' || !e.item) continue;
    const k = nameCore(e.item);
    const it = m.get(k) ?? { key: k, item: e.item, supplier: lastSupplier.get(k) ?? null, ids: [] };
    it.ids.push(e.id);
    m.set(k, it);
  }
  return [...m.values()];
}

export function groupBySupplier(items: ReorderItem[]): { supplier: string | null; items: ReorderItem[] }[] {
  const g = new Map<string, { supplier: string | null; items: ReorderItem[] }>();
  for (const it of items) {
    const k = it.supplier ? nameCore(it.supplier) : '';
    const grp = g.get(k) ?? { supplier: it.supplier, items: [] };
    grp.items.push(it);
    g.set(k, grp);
  }
  // known suppliers first, "no supplier" last
  return [...g.values()].sort((a, b) => (a.supplier ? 0 : 1) - (b.supplier ? 0 : 1));
}

export function openOrders(entries: Entry[], parties: Party[]): (Entry & { name: string | null })[] {
  const byId = new Map(parties.map((p) => [p.id, p]));
  return entries
    .filter((e) => e.type === 'pending_order' && e.status !== 'done')
    .map((e) => ({ ...e, name: (e.partyId && byId.get(e.partyId)?.name) || e.party }))
    .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'));
}

export interface KalKaKaam {
  pay: Balance[];
  reorder: ReorderItem[];
  orders: (Entry & { name: string | null })[];
  milna: number;
  dena: number;
}

export function kalKaKaam(entries: Entry[], parties: Party[], today: string): KalKaKaam {
  const tmr = addDaysIso(today, 1);
  const sups = supplierDues(entries, parties);
  const cus = customerCredit(entries, parties);
  return {
    pay: sups.filter((x) => x.due && x.due <= tmr),
    reorder: openReorders(entries, parties),
    orders: openOrders(entries, parties).filter((o) => !o.due || o.due <= tmr),
    milna: total(cus),
    dena: total(sups),
  };
}

export function snapshot(entries: Entry[], parties: Party[], today: string): LedgerSnapshot {
  return {
    today,
    suppliers_owed: supplierDues(entries, parties).map((x) => ({ name: x.name, amount: x.bal, due: x.due })),
    customers_owe: customerCredit(entries, parties).map((x) => ({ name: x.name, amount: x.bal })),
    to_reorder: openReorders(entries, parties).map((i) => ({ item: i.item, supplier: i.supplier })),
    pending_orders: openOrders(entries, parties).map((o) => ({ party: o.name, item: o.item, due: o.due })),
  };
}

export function partyHistory(entries: Entry[], partyId: string): Entry[] {
  return entries.filter((e) => e.partyId === partyId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function partySide(entries: Entry[], partyId: string): 'supplier' | 'customer' | null {
  let s = 0;
  let c = 0;
  for (const e of entries) {
    if (e.partyId !== partyId) continue;
    if (e.type === 'supplier_due' || e.type === 'supplier_paid' || e.type === 'reorder') s++;
    if (e.type === 'credit_given' || e.type === 'credit_received' || e.type === 'pending_order') c++;
  }
  return s === 0 && c === 0 ? null : s >= c ? 'supplier' : 'customer';
}
