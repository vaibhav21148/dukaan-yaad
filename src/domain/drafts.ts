// Extracted entries -> review cards, with party matching and the never-invent guard.
import { neverInvent } from '../../shared/guard';
import { doubt, orList } from '../../shared/messages';
import { matchParty, nameCore } from '../../shared/names';
import type { DraftEntry, ExtractedEntry, Lang, Party } from '../../shared/types';

let n = 0;
export const draftKey = () => `d${Date.now().toString(36)}${(n++).toString(36)}`;

export function toDrafts(extracted: ExtractedEntry[], transcript: string, parties: Party[], lang: Lang): DraftEntry[] {
  // The guard runs on every path (online results are already guarded on the server; this is a second check).
  const { entries } = neverInvent(extracted, transcript, lang);
  return entries.map((e) => resolveParty({ ...e, key: draftKey(), partyId: null }, parties, lang));
}

export function resolveParty(d: DraftEntry, parties: Party[], lang: Lang): DraftEntry {
  if (!d.party) return { ...d, partyId: null, choices: undefined, choiceQuestion: undefined };
  if (d.forceNew) return { ...d, partyId: null, choices: undefined, choiceQuestion: undefined };
  const m = matchParty(d.party, parties);
  if (m.kind === 'exact' || m.kind === 'one') return { ...d, partyId: m.party.id, choices: undefined, choiceQuestion: undefined };
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
