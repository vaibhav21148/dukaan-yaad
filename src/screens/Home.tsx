import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Entry, Note, Party } from '../../shared/types';
import { kalKaKaam } from '../domain/ledger';
import { rs, useFmtDate } from '../lib/hooks';

export function Home({ entries, parties, notes, today }: { entries: Entry[]; parties: Party[]; notes: Note[]; today: string }) {
  const { t } = useTranslation();
  const fmt = useFmtDate();
  const k = kalKaKaam(entries, parties, today);
  const [open, setOpen] = useState<string | null>(null);
  const nothing = !k.pay.length && !k.reorder.length && !k.orders.length;
  return (
    <>
      <section aria-labelledby="h-kal">
        <h2 id="h-kal">{t('home.kal')}</h2>
        {nothing && <p className="empty">{entries.length ? t('home.nothing') : t('home.noPay')}</p>}
        {k.pay.map((x) => (
          <div className="card row" key={x.key}>
            <div>
              <b>{t('home.payTo', { name: x.name })}</b>
              <br />
              <span className={`tag ${x.due && x.due < today ? 'late' : ''}`}>{fmt(x.due, today)}</span>
            </div>
            <span className="amt">{rs(x.bal)}</span>
          </div>
        ))}
        {!k.pay.length && !nothing && <p className="empty">{t('home.noPay')}</p>}
        {k.reorder.length > 0 && (
          <div className="card">
            <b>{t('home.reorder', { count: k.reorder.length })}</b>
            <div className="items">{k.reorder.map((i) => i.item).join(', ')}</div>
          </div>
        )}
        {k.orders.map((o) => (
          <div className="card row" key={o.id}>
            <div>
              <b>{t('home.orderOf', { name: o.name ?? '?' })}</b>
              {o.item ? `: ${o.item}` : ''}
              <br />
              {o.due ? <span className="tag">{fmt(o.due, today)}</span> : <span className="note-s">{t('home.noDate')}</span>}
            </div>
          </div>
        ))}
      </section>
      <section aria-labelledby="h-notes">
        <h2 id="h-notes">{t('home.notes')}</h2>
        {!notes.length && <p className="empty">{t('home.noNotes')}</p>}
        {notes.slice(0, 8).map((n) => {
          const isOpen = open === n.id;
          const list = isOpen ? entries.filter((e) => e.noteId === n.id) : [];
          return (
            <div className="card" key={n.id}>
              <button type="button" className="linkish" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : n.id)}>
                <span className="note-meta">
                  <span>{new Date(n.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                  <span>{t('home.entries', { count: n.entryIds.length })}</span>
                </span>
                <span className="note-text">{n.text}</span>
              </button>
              {isOpen && (
                <ul className="mini">
                  {list.map((e) => (
                    <li key={e.id}>
                      <span className="tag">{t(`types.${e.type}`)}</span> {e.party ?? ''} {e.item ?? ''} {e.amount != null ? rs(e.amount) : ''}
                      {e.status === 'done' ? ' ✓' : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>
    </>
  );
}
