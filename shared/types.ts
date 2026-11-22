// Core data model shared by the browser app, the /api functions and the eval harness.

export type Lang = 'hi' | 'en' | 'mr' | 'gu';
export const LANGS: Lang[] = ['hi', 'en', 'mr', 'gu'];

export type EntryType =
  | 'supplier_due'
  | 'supplier_paid'
  | 'credit_given'
  | 'credit_received'
  | 'reorder'
  | 'pending_order';

export const ENTRY_TYPES: EntryType[] = [
  'supplier_due',
  'supplier_paid',
  'credit_given',
  'credit_received',
  'reorder',
  'pending_order',
];

/** Which side of the ledger an entry type belongs to. */
export const SIDE: Record<EntryType, 'supplier' | 'customer' | 'stock'> = {
  supplier_due: 'supplier',
  supplier_paid: 'supplier',
  credit_given: 'customer',
  credit_received: 'customer',
  reorder: 'stock',
  pending_order: 'customer',
};

/** What an extractor (online or offline) returns. Same shape for both paths. */
export interface ExtractedEntry {
  type: EntryType;
  party: string | null;
  amount: number | null;
  item: string | null;
  due: string | null; // YYYY-MM-DD
  unclear: string | null; // one short question, or null
  quote: string; // exact words this entry came from
}

export interface PartyChoice {
  partyId: string;
  name: string;
}

/** An entry on the review screen, before the owner confirms. */
export interface DraftEntry extends ExtractedEntry {
  key: string;
  partyId: string | null;
  choices?: PartyChoice[]; // set when two parties could match
  forceNew?: boolean; // owner said it is a new person, do not match
  choiceQuestion?: string; // "Kaun se Sharma? Sharma ji ya Sharma uncle?"
}

export type EntrySource = 'note' | 'button' | 'demo';

/** A saved entry. Never created without owner confirmation. */
export interface Entry {
  id: string;
  noteId: string | null;
  type: EntryType;
  partyId: string | null;
  party: string | null; // display name as spoken/edited
  amount: number | null;
  item: string | null;
  due: string | null;
  quote: string;
  status: 'open' | 'done';
  createdAt: string; // ISO
  source: EntrySource;
  demo?: boolean;
}

export interface Party {
  id: string;
  name: string;
  aliases: string[]; // other spoken forms, e.g. "Sharma uncle"
  createdAt: string;
  demo?: boolean;
}

export type ExtractBy = 'gemini' | 'groq' | 'anthropic' | 'offline' | 'demo' | 'cache';

export interface Note {
  id: string;
  text: string;
  createdAt: string;
  entryIds: string[];
  by: ExtractBy;
  stt: string | null; // engine id that produced the transcript, null if typed
  lang: Lang;
  demo?: boolean;
}

export type SttPref = 'auto' | Lang;
export type WhisperSize = 'tiny' | 'base' | 'small';

export interface Settings {
  id: 'app';
  lang: Lang;
  onboarded: boolean;
  sttLang: SttPref; // 'auto' lets Whisper detect
  autoStopMs: number;
  readAloud: boolean;
  whisperModel: WhisperSize;
  onlineAi: boolean; // owner can turn online AI off
  theme: 'system' | 'light' | 'dark';
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  lang: 'hi',
  onboarded: false,
  sttLang: 'auto',
  autoStopMs: 2000,
  readAloud: false,
  whisperModel: 'base',
  onlineAi: true,
  theme: 'system',
};

/** Ledger snapshot sent to /api/ask and used by the local answerer. */
export interface LedgerSnapshot {
  today: string;
  suppliers_owed: { name: string; amount: number; due: string | null }[];
  customers_owe: { name: string; amount: number }[];
  to_reorder: { item: string; supplier: string | null }[];
  pending_orders: { party: string | null; item: string | null; due: string | null }[];
}
