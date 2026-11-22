import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addDaysIso, todayIso } from '../../shared/dates';
import { DEFAULT_SETTINGS, type Entry, type Note, type Party, type Settings } from '../../shared/types';
import { db, type CurrentDraft } from '../db/db';

export interface Data {
  entries: Entry[];
  parties: Party[];
  notes: Note[];
  settings: Settings;
  draft: CurrentDraft | null;
  ready: boolean;
}

export function useData(): Data {
  const entries = useLiveQuery(() => db.entries.toArray(), [], undefined);
  const parties = useLiveQuery(() => db.parties.toArray(), [], undefined);
  const notes = useLiveQuery(() => db.notes.orderBy('createdAt').reverse().limit(30).toArray(), [], undefined);
  const settings = useLiveQuery(() => db.settings.get('app'), [], null);
  const draft = useLiveQuery(() => db.drafts.get('current'), [], null);
  return {
    entries: entries ?? [],
    parties: parties ?? [],
    notes: notes ?? [],
    settings: { ...DEFAULT_SETTINGS, ...(settings ?? {}) },
    draft: draft ?? null,
    ready: entries !== undefined && parties !== undefined && settings !== null,
  };
}

/** Today's date, refreshed when the tab regains focus (shops stay open past midnight). */
export function useToday(): string {
  const [t, setT] = useState(todayIso());
  useEffect(() => {
    const f = () => setT(todayIso());
    window.addEventListener('focus', f);
    const i = setInterval(f, 60000);
    return () => {
      window.removeEventListener('focus', f);
      clearInterval(i);
    };
  }, []);
  return t;
}

export function useOnline(): boolean {
  const [on, setOn] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true);
    const b = () => setOn(false);
    window.addEventListener('online', a);
    window.addEventListener('offline', b);
    return () => {
      window.removeEventListener('online', a);
      window.removeEventListener('offline', b);
    };
  }, []);
  return on;
}

export const rs = (n: number | null | undefined) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');

export function useFmtDate() {
  const { t } = useTranslation();
  return (d: string | null, today: string) => {
    if (!d) return '';
    const short = new Date(d + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    if (d < today) return t('date.late', { d: short });
    if (d === today) return t('date.today');
    if (d === addDaysIso(today, 1)) return t('date.tomorrow');
    return short;
  };
}
