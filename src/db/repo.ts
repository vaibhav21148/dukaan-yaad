// All writes go through here. Every write returns an Undo so the UI can offer 10-second undo.
import { matchParty, nameCore, cleanName } from '../../shared/names';
import type { DraftEntry, Entry, EntryType, ExtractBy, Lang, Note, Party } from '../../shared/types';
import type { Balance } from '../domain/ledger';
import { db, type DukaanDb } from './db';

export interface Undo {
  label: string;
  revert: () => Promise<void>;
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const now = () => new Date().toISOString();

export interface SaveInput {
  text: string;
  entries: DraftEntry[];
  by: ExtractBy;
  stt: string | null;
  lang: Lang;
  demo?: boolean;
}

/** Owner tapped "Sab sahi hai, save karo". Creates parties/aliases, entries and the note. */
export async function saveNote(input: SaveInput, d: DukaanDb = db): Promise<Undo & { noteId: string }> {
  const noteId = uid();
  const at = now();
  const createdParties: string[] = [];
  const changedParties: Party[] = []; // previous versions, for undo
  const entryIds: string[] = [];
  await d.transaction('rw', [d.entries, d.parties, d.notes, d.drafts], async () => {
    const parties = await d.parties.toArray();
    for (const de of input.entries) {
      let partyId = de.partyId;
      const spoken = de.party?.trim() || null;
      if (spoken && !partyId) {
        // match again against parties created earlier in this same save
        const m = de.forceNew ? ({ kind: 'none' } as const) : matchParty(spoken, parties);
        if (m.kind === 'exact' || m.kind === 'one') partyId = m.party.id;
        else {
          const p: Party = { id: uid(), name: spoken, aliases: [], createdAt: at, demo: input.demo || undefined };
          await d.parties.add(p);
          parties.push(p);
          createdParties.push(p.id);
          partyId = p.id;
        }
      }
      if (partyId && spoken) {
        const p = parties.find((x) => x.id === partyId);
        const forms = p ? [p.name, ...p.aliases].map(cleanName) : [];
        if (p && !forms.includes(cleanName(spoken))) {
          if (!createdParties.includes(p.id) && !changedParties.some((c) => c.id === p.id)) changedParties.push({ ...p, aliases: [...p.aliases] });
          p.aliases = [...p.aliases, spoken];
          await d.parties.put(p);
        }
      }
      const e: Entry = {
        id: uid(),
        noteId,
        type: de.type,
        partyId: partyId ?? null,
        party: spoken,
        amount: de.amount ?? null,
        item: de.item?.trim() || null,
        due: de.due ?? null,
        quote: de.quote,
        status: 'open',
        createdAt: at,
        source: input.demo ? 'demo' : 'note',
        demo: input.demo || undefined,
      };
      await d.entries.add(e);
      entryIds.push(e.id);
    }
    const note: Note = { id: noteId, text: input.text, createdAt: at, entryIds, by: input.by, stt: input.stt, lang: input.lang, demo: input.demo || undefined };
    await d.notes.add(note);
    await d.drafts.delete('current');
  });
  return {
    noteId,
    label: 'saved',
    revert: async () => {
      await d.transaction('rw', d.entries, d.parties, d.notes, async () => {
        await d.entries.bulkDelete(entryIds);
        await d.notes.delete(noteId);
        await d.parties.bulkDelete(createdParties);
        if (changedParties.length) await d.parties.bulkPut(changedParties);
      });
    },
  };
}

async function addButtonEntry(type: EntryType, b: Balance, quote: string, d: DukaanDb): Promise<Undo> {
  const e: Entry = {
    id: uid(),
    noteId: null,
    type,
    partyId: b.partyId,
    party: b.name,
    amount: b.bal,
    item: null,
    due: null,
    quote,
    status: 'open',
    createdAt: now(),
    source: 'button',
  };
  await d.entries.add(e);
  return { label: type, revert: () => d.entries.delete(e.id) };
}

/** "Paid" on a supplier: records a payment of the full balance. */
export const markPaid = (b: Balance, d: DukaanDb = db) => addButtonEntry('supplier_paid', b, 'Paid', d);
/** "Mil gaya" on a customer: records full settlement. */
export const markSettled = (b: Balance, d: DukaanDb = db) => addButtonEntry('credit_received', b, 'Mil gaya', d);

/** "Mangwa liya" / "Ho gaya": close reorder items or orders. */
export async function markDone(ids: string[], d: DukaanDb = db): Promise<Undo> {
  const before = await d.entries.bulkGet(ids);
  await d.entries.bulkUpdate(ids.map((id) => ({ key: id, changes: { status: 'done' as const } })));
  return {
    label: 'done',
    revert: async () => {
      await d.entries.bulkPut(before.filter((x): x is Entry => !!x));
    },
  };
}

export async function clearDemo(d: DukaanDb = db): Promise<void> {
  await d.transaction('rw', d.entries, d.parties, d.notes, async () => {
    await d.entries.filter((e) => !!e.demo).delete();
    await d.parties.filter((p) => !!p.demo).delete();
    await d.notes.filter((n) => !!n.demo).delete();
  });
}

export async function wipeAll(d: DukaanDb = db): Promise<void> {
  await d.transaction('rw', [d.entries, d.parties, d.notes, d.drafts, d.cache], async () => {
    await Promise.all([d.entries.clear(), d.parties.clear(), d.notes.clear(), d.drafts.clear(), d.cache.clear()]);
  });
}

export async function hasDemo(d: DukaanDb = db): Promise<boolean> {
  return (await d.entries.filter((e) => !!e.demo).count()) > 0;
}

export function partyByName(parties: Party[], name: string): Party | undefined {
  return parties.find((p) => nameCore(p.name) === nameCore(name));
}
