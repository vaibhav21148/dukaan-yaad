// Bundle entry for the Claude Artifact build. Exposes the app's tested logic as window.DY.
// No Dexie, no fetch to /api: storage is the artifact `db` capability, AI is the `sample` capability.
import { addDaysIso, todayIso } from '../shared/dates';
import { neverInvent } from '../shared/guard';
import { cleanName, matchParty } from '../shared/names';
import { askPrompt, extractPrompt } from '../shared/prompts';
import { ENTRY_TYPES, type DraftEntry, type Entry, type ExtractBy, type ExtractedEntry, type Lang, type Note, type Party } from '../shared/types';
import { answerIsGrounded } from '../src/ask';
import { answerLocal } from '../src/ask/local';
import { buildDemoLedger, demoExtraction } from '../src/domain/demoData';
import { chooseParty, NEW_PARTY, resolveParty, toDrafts } from '../src/domain/drafts';
import * as ledger from '../src/domain/ledger';
import { parseOffline } from '../src/extract/offline/parser';
import en from '../src/i18n/en.json';
import gu from '../src/i18n/gu.json';
import hi from '../src/i18n/hi.json';
import mr from '../src/i18n/mr.json';

export interface Ledger {
  v: 1;
  entries: Entry[];
  parties: Party[];
  notes: Note[];
}
export const emptyLedger = (): Ledger => ({ v: 1, entries: [], parties: [], notes: [] });

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

/** Lenient validation of model output (same rules as the server's Zod schema). */
export function validateEntries(raw: unknown): ExtractedEntry[] {
  const list = (raw as { entries?: unknown[] })?.entries;
  if (!Array.isArray(list)) return [];
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const out: ExtractedEntry[] = [];
  for (const e of list) {
    if (!e || typeof e !== 'object') continue;
    const o = e as Record<string, unknown>;
    if (!ENTRY_TYPES.includes(o.type as never)) continue;
    const n = typeof o.amount === 'number' ? o.amount : Number(String(o.amount ?? '').replace(/[^\d.]/g, ''));
    out.push({
      type: o.type as ExtractedEntry['type'],
      party: str(o.party),
      amount: o.amount == null || o.amount === '' || !Number.isFinite(n) || n <= 0 ? null : n,
      item: str(o.item),
      due: typeof o.due === 'string' && /^\d{4}-\d\d-\d\d$/.test(o.due) ? o.due : null,
      unclear: str(o.unclear),
      quote: str(o.quote) ?? '',
    });
  }
  return out;
}

/** Pure version of the app's saveNote: owner confirmed the cards. Returns the new ledger. */
export function applySave(l: Ledger, input: { text: string; entries: DraftEntry[]; by: ExtractBy; stt: string | null; lang: Lang; demo?: boolean }): Ledger {
  const next: Ledger = JSON.parse(JSON.stringify(l));
  const at = new Date().toISOString();
  const noteId = uid();
  const ids: string[] = [];
  for (const de of input.entries) {
    let partyId = de.partyId;
    const spoken = de.party?.trim() || null;
    if (spoken && !partyId) {
      const m = de.forceNew ? ({ kind: 'none' } as const) : matchParty(spoken, next.parties);
      if (m.kind === 'exact' || m.kind === 'one') partyId = m.party.id;
      else {
        const p: Party = { id: uid(), name: spoken, aliases: [], createdAt: at, demo: input.demo || undefined };
        next.parties.push(p);
        partyId = p.id;
      }
    }
    if (partyId && spoken) {
      const p = next.parties.find((x) => x.id === partyId);
      if (p && ![p.name, ...p.aliases].map(cleanName).includes(cleanName(spoken))) p.aliases.push(spoken);
    }
    const e: Entry = {
      id: uid(), noteId, type: de.type, partyId: partyId ?? null, party: spoken, amount: de.amount ?? null,
      item: de.item?.trim() || null, due: de.due ?? null, quote: de.quote, status: 'open', createdAt: at,
      source: input.demo ? 'demo' : 'note', demo: input.demo || undefined,
    };
    next.entries.push(e);
    ids.push(e.id);
  }
  next.notes.push({ id: noteId, text: input.text, createdAt: at, entryIds: ids, by: input.by, stt: input.stt, lang: input.lang, demo: input.demo || undefined });
  return next;
}

export function addButtonEntry(l: Ledger, type: Entry['type'], b: ledger.Balance, quote: string): Ledger {
  const next: Ledger = JSON.parse(JSON.stringify(l));
  next.entries.push({ id: uid(), noteId: null, type, partyId: b.partyId, party: b.name, amount: b.bal, item: null, due: null, quote, status: 'open', createdAt: new Date().toISOString(), source: 'button' });
  return next;
}
export function markDone(l: Ledger, ids: string[]): Ledger {
  const next: Ledger = JSON.parse(JSON.stringify(l));
  for (const e of next.entries) if (ids.includes(e.id)) e.status = 'done';
  return next;
}
export function withDemo(l: Ledger, lang: Lang, today: string): Ledger {
  if (l.entries.some((e) => e.demo)) return l;
  const d = buildDemoLedger(lang, today);
  return { ...l, parties: [...l.parties, ...d.parties], entries: [...l.entries, ...d.entries], notes: [...l.notes, d.note] };
}
export function withoutDemo(l: Ledger): Ledger {
  return { ...l, parties: l.parties.filter((p) => !p.demo), entries: l.entries.filter((e) => !e.demo), notes: l.notes.filter((n) => !n.demo) };
}
export const sidesOf = (l: Ledger) => Object.fromEntries(l.parties.map((p) => [p.id, ledger.partySide(l.entries, p.id)]));

export const I18N = { hi, en, mr, gu } as Record<Lang, Record<string, unknown>>;

export {
  addDaysIso, todayIso, neverInvent, extractPrompt, askPrompt, answerLocal, answerIsGrounded, parseOffline,
  toDrafts, resolveParty, chooseParty, NEW_PARTY, demoExtraction, ledger, matchParty,
};
