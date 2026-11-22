import type { Lang } from '../../shared/types';
import { db, type DukaanDb } from '../db/db';
import { buildDemoLedger } from './demoData';
export { DEMO_NOTES, demoExtraction } from './demoData';

export async function loadDemoLedger(lang: Lang, today: string, d: DukaanDb = db): Promise<void> {
  const { parties, entries, note } = buildDemoLedger(lang, today);
  await d.transaction('rw', d.entries, d.parties, d.notes, async () => {
    await d.parties.bulkPut(parties);
    await d.entries.bulkPut(entries);
    await d.notes.put(note);
  });
}
