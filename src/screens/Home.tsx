import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Entry, Note, Party } from '../../shared/types';
import { Badge, Icon, Steps, TYPE_ICON, type IconName } from '../components/Icons';
import { kalKaKaam } from '../domain/ledger';
import { rs, useFmtDate } from '../lib/hooks';

export function Home({ entries, parties, notes, today }: { entries: Entry[]; parties: Party[]; notes: Note[]; today: string }) {
  const { t } = useTranslation();
  const fmt = useFmtDate();
  const k = kalKaKaam(entries, parties, today);
  const [open, setOpen] = useState<string | null>(null);
  const nothing = !k.pay.length && !k.reorder.length && !k.orders.length;
  const Row = ({ icon, tone, title, meta, right }: { icon: IconName; tone?: string; title: string; meta?: React.ReactNode; right?: React.ReactNode }) => (
    <div className="card line">
      <Badge name={icon} tone={tone} />
      <div className="line-main">
        <b>{title}</b>
        {meta && <div className="line-meta">{meta}</div>}
      </div>
      {right && <div className="line-right">{right}</div>}
    </div>
  );
  return (
    <>
      {!entries.length && (
        <section aria-label={t('journey.step1')}>
          <Steps t={t} />
        </section>
      )}
      <section aria-labelledby="h-kal">
        <h2 id="h-kal">
          <Icon name="today" />
          {t('home.kal')}
        </h2>
        {nothing && <p className="empty">{t('journey.kalEmpty')}</p>}
        {k.pay.map((x) => (
          <Row
            key={x.key}
            icon="truck"
            tone={x.due && x.due < today ? 'late' : ''}
            title={t('home.payTo', { name: x.name })}
            meta={<span className={`tag ${x.due && x.due < today ? 'late' : ''}`}>{fmt(x.due, today)}</span>}
            right={<span className="amt">{rs(x.bal)}</span>}
          />
        ))}
        {k.reorder.length > 0 && <Row icon="cart" title={t('home.reorder', { count: k.reorder.length })} meta={k.reorder.map((i) => i.item).join(', ')} />}
        {k.orders.map((o) => (
          <Row key={o.id} icon="bag" title={t('home.orderOf', { name: o.name ?? '?' })} meta={`${o.item ? o.item + ' · ' : ''}${o.due ? fmt(o.due, today) : t('home.noDate')}`} />
        ))}
      </section>
      {notes.length > 0 && (
      <section aria-labelledby="h-notes">
        <h2 id="h-notes">
          <Icon name="note" />
          {t('home.notes')}
        </h2>
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
                      <Badge name={TYPE_ICON[e.type]} tone="xs" /> {e.party ?? ''} {e.item ?? ''} {e.amount != null ? rs(e.amount) : ''}
                      {e.status === 'done' ? ' ✓' : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>
      )}
    </>
  );
}
