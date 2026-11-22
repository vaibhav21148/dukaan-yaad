import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Entry, Party } from '../../shared/types';
import { Badge, Icon, TYPE_ICON, type IconName } from '../components/Icons';
import { customerCredit, groupBySupplier, openOrders, openReorders, partyHistory, supplierDues, type Balance } from '../domain/ledger';
import { rs, useFmtDate } from '../lib/hooks';

type Sub = 'sup' | 'cus' | 'maal' | 'ord';

export function Khata(props: {
  entries: Entry[];
  parties: Party[];
  today: string;
  onPaid: (b: Balance) => void;
  onSettle: (b: Balance) => void;
  onDone: (ids: string[], kind: 'maal' | 'ord') => void;
}) {
  const { t } = useTranslation();
  const fmt = useFmtDate();
  const [sub, setSub] = useState<Sub>('sup');
  const [hist, setHist] = useState<Balance | null>(null);
  const { entries, parties, today } = props;
  const sups = supplierDues(entries, parties);
  const cus = customerCredit(entries, parties);

  const NameBtn = ({ b }: { b: Balance }) =>
    b.partyId ? (
      <button type="button" className="linkish name" onClick={() => setHist(hist?.key === b.key ? null : b)} aria-expanded={hist?.key === b.key}>
        {b.name}
      </button>
    ) : (
      <b>{b.name}</b>
    );

  const History = ({ b }: { b: Balance }) =>
    hist?.key === b.key && b.partyId ? (
      <div className="history">
        <div className="note-s">{t('khata.history', { name: b.name })}</div>
        <ul className="mini">
          {partyHistory(entries, b.partyId).map((e) => (
            <li key={e.id}>
              <Badge name={TYPE_ICON[e.type]} tone="xs" /> <span className="note-s">{new Date(e.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>{' '}
              {e.amount != null ? rs(e.amount) : ''} {e.item ?? ''}
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  const reo = openReorders(entries, parties);
  const ord = openOrders(entries, parties);
  const counts: Record<Sub, number> = { sup: sups.length, cus: cus.length, maal: reo.length, ord: ord.length };
  const tabIcon: Record<Sub, IconName> = { sup: 'truck', cus: 'person', maal: 'cart', ord: 'bag' };
  const Act = ({ label, icon, onClick }: { label: string; icon: IconName; onClick: () => void }) => (
    <button type="button" className="act-btn" onClick={onClick}>
      <Icon name={icon} />
      {label}
    </button>
  );
  const Line = ({ icon, tone, title, meta, right, children }: { icon: IconName; tone?: string; title: React.ReactNode; meta?: React.ReactNode; right?: React.ReactNode; children?: React.ReactNode }) => (
    <>
      <div className="card line">
        <Badge name={icon} tone={tone} />
        <div className="line-main">
          <b>{title}</b>
          {meta && <div className="line-meta">{meta}</div>}
        </div>
        {right && <div className="line-right">{right}</div>}
      </div>
      {children}
    </>
  );

  return (
    <section aria-labelledby="h-khata">
      <h2 id="h-khata">
        <Icon name="book" />
        {t('khata.title')}
      </h2>
      <div className="subtabs" role="group" aria-label={t('khata.groupLabel')}>
        {(['sup', 'cus', 'maal', 'ord'] as Sub[]).map((s) => (
          <button type="button" key={s} aria-pressed={sub === s} onClick={() => setSub(s)}>
            <Icon name={tabIcon[s]} />
            <span>{t(`khata.tabs.${s}`)}</span>
            {counts[s] > 0 && <span className="count">{counts[s]}</span>}
          </button>
        ))}
      </div>
      <div className="list">
        {sub === 'sup' &&
          (sups.length ? (
            sups.map((x) => (
              <Line
                key={x.key}
                icon="truck"
                tone={x.due && x.due < today ? 'late' : ''}
                title={<NameBtn b={x} />}
                meta={x.due ? <span className={`tag ${x.due < today ? 'late' : ''}`}>{fmt(x.due, today)}</span> : undefined}
                right={
                  <>
                    <span className="amt">{rs(x.bal)}</span>
                    <Act label={t('khata.paid')} icon="check" onClick={() => props.onPaid(x)} />
                  </>
                }
              >
                <History b={x} />
              </Line>
            ))
          ) : (
            <p className="empty">{t('khata.noSup')}</p>
          ))}
        {sub === 'cus' &&
          (cus.length ? (
            cus.map((x) => (
              <Line
                key={x.key}
                icon="person"
                title={<NameBtn b={x} />}
                right={
                  <>
                    <span className="amt">{rs(x.bal)}</span>
                    <Act label={t('khata.settle')} icon="moneyIn" onClick={() => props.onSettle(x)} />
                  </>
                }
              >
                <History b={x} />
              </Line>
            ))
          ) : (
            <p className="empty">{t('khata.noCus')}</p>
          ))}
        {sub === 'maal' &&
          (reo.length ? (
            groupBySupplier(reo).map((g) => (
              <div key={g.supplier ?? '-'} className="group">
                <h3>
                  <Icon name="truck" />
                  {g.supplier ?? t('khata.noSupplier')}
                </h3>
                {g.items.map((i) => (
                  <Line key={i.key} icon="cart" title={i.item} right={<Act label={t('khata.gotIt')} icon="check" onClick={() => props.onDone(i.ids, 'maal')} />} />
                ))}
              </div>
            ))
          ) : (
            <p className="empty">{t('khata.noMaal')}</p>
          ))}
        {sub === 'ord' &&
          (ord.length ? (
            ord.map((x) => (
              <Line
                key={x.id}
                icon="bag"
                title={x.name ?? '?'}
                meta={
                  <>
                    {x.item ?? ''}
                    {x.amount ? ` · ${rs(x.amount)}` : ''}
                    {x.due && <span className={`tag ${x.due < today ? 'late' : ''}`}> {fmt(x.due, today)}</span>}
                  </>
                }
                right={<Act label={t('khata.done')} icon="check" onClick={() => props.onDone([x.id], 'ord')} />}
              />
            ))
          ) : (
            <p className="empty">{t('khata.noOrd')}</p>
          ))}
      </div>
    </section>
  );
}
