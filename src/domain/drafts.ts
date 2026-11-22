// Extracted entries -> review cards, with party matching and the never-invent guard.
import { neverInvent } from '../../shared/guard';
import { doubt, orList } from '../../shared/messages';
import { matchParty, nameCore } from '../../shared/names';
import { SIDE, type DraftEntry, type ExtractedEntry, type Lang, type Party } from '../../shared/types';

export type Sides = Record<string, 'supplier' | 'customer' | null>;

let n = 0;
export const draftKey = () => `d${Date.now().toString(36)}${(n++).toString(36)}`;

export function toDrafts(extracted: ExtractedEntry[], transcript: string, parties: Party[], lang: Lang, sides: Sides = {}): DraftEntry[] {
  // The guard runs on every path (online results are already guarded on the server; this is a second check).
  const { entries } = neverInvent(extracted, transcript, lang);
  return entries.map((e) => resolveParty({ ...e, key: draftKey(), partyId: null }, parties, lang, sides));
}

export function resolveParty(d: DraftEntry, parties: Party[], lang: Lang, sides: Sides = {}): DraftEntry {
  if (!d.party) return { ...d, partyId: null, choices: undefined, choiceQuestion: undefined };
  if (d.forceNew) return { ...d, partyId: null, choices: undefined, choiceQuestion: undefined };
  const m = matchParty(d.party, parties);
  if (m.kind === 'exact') return { ...d, partyId: m.party.id, choices: undefined, choiceQuestion: undefined };
  if (m.kind === 'one') {
    // A near match on the other side of the ledger ("Gupta ji" customer vs "Gupta Traders" supplier)
    // could credit the wrong person: ask instead of linking.
    const entrySide = SIDE[d.type] === 'stock' ? 'supplier' : SIDE[d.type];
    const partySide = sides[m.party.id];
    if (partySide && partySide !== entrySide) {
      const q = doubt(lang, 'whichParty', { name: d.party, options: orList(lang, [m.party.name, doubt(lang, 'newPerson')]) });
      return { ...d, partyId: null, choices: [{ partyId: m.party.id, name: m.party.name }], choiceQuestion: q };
    }
    return { ...d, partyId: m.party.id, choices: undefined, choiceQuestion: undefined };
  }
  if (m.kind === 'many') {
    const names = m.parties.map((p) => p.name);
    const q = doubt(lang, 'whichParty', { name: nameCore(d.party).replace(/^\p{Ll}/u, (c) => c.toUpperCase()), options: orList(lang, names) });
    return { ...d, partyId: null, choices: m.parties.map((p) => ({ partyId: p.id, name: p.name })), choiceQuestion: q };
  }
  return { ...d, partyId: null, choices: undefined, choiceQuestion: undefined };
}

/** Owner picked one of the suggested parties. */
export const NEW_PARTY = '__new__';
export function chooseParty(d: DraftEntry, partyId: string, parties: Party[]): DraftEntry {
  if (partyId === NEW_PARTY) return { ...d, partyId: null, forceNew: true, choices: undefined, choiceQuestion: undefined };
  const p = parties.find((x) => x.id === partyId);
  if (!p) return d;
  return { ...d, partyId: p.id, choices: undefined, choiceQuestion: undefined };
}
