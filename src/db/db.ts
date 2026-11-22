import Dexie, { type Table } from 'dexie';
import { DEFAULT_SETTINGS, type DraftEntry, type Entry, type ExtractBy, type Note, type Party, type Settings } from '../../shared/types';

/** The note currently on the review screen. Survives reloads; holds the raw audio until saved. */
export interface CurrentDraft {
  id: 'current';
  text: string;
  entries: DraftEntry[];
  by: ExtractBy;
  stt: string | null;
  audio: Blob | null;
  offlineParsed: boolean;
  createdAt: string;
}

export interface CacheRow {
  hash: string;
  result: unknown;
  at: number;
}

export class DukaanDb extends Dexie {
  entries!: Table<Entry, string>;
  parties!: Table<Party, string>;
  notes!: Table<Note, string>;
  settings!: Table<Settings, string>;
  drafts!: Table<CurrentDraft, string>;
  cache!: Table<CacheRow, string>;

  constructor(name = 'dukaan-yaad') {
    super(name);
    // v1: initial schema. Add new versions below; never edit an old one.
    this.version(1).stores({
      entries: 'id, noteId, partyId, type, status, createdAt, demo',
      parties: 'id, name, demo',
      notes: 'id, createdAt, demo',
      settings: 'id',
      drafts: 'id',
      cache: 'hash, at',
    });
  }
}

export const db = new DukaanDb();

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('app');
  return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
}
export async function putSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch, id: 'app' as const };
  await db.settings.put(next);
  return next;
}
