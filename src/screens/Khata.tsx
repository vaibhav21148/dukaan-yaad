import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Entry, Party } from '../../shared/types';
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
              <span className="note-s">{new Date(e.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span> <span className="tag">{t(`types.${e.type}`)}</span>{' '}
              {e.amount != null ? rs(e.amount) : ''} {e.item ?? ''}
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <section aria-labelledby="h-khata">
      <h2 id="h-khata">{t('khata.title')}</h2>
      <div className="subtabs" role="group" aria-label={t('khata.groupLabel')}>
        {(['sup', 'cus', 'maal', 'ord'] as Sub[]).map((s) => (
          <button type="button" key={s} className="small" aria-pressed={sub === s} onClick={() => setSub(s)}>
            {t(`khata.tabs.${s}`)}
          </button>
        ))}
      </div>
      <div className="list">
        {sub === 'sup' &&
          (sups.length ? (
            sups.map((x) => (
              <div className="card" key={x.key}>
                <div className="row">
                  <div>
                    <NameBtn b={x} />
                    {x.due && (
                      <>
                        <br />
                        <span className={`tag ${x.due < today ? 'late' : ''}`}>{fmt(x.due, today)}</span>
                      </>
                    )}
                  </div>
                  <div className="row">
                    <span className="amt">{rs(x.bal)}</span>
                    <button type="button" className="small" onClick={() => props.onPaid(x)}>
                      {t('khata.paid')}
                    </button>
                  </div>
                </div>
                <History b={x} />
              </div>
            ))
          ) : (
            <p className="empty">{t('khata.noSup')}</p>
          ))}
        {sub === 'cus' &&
          (cus.length ? (
            cus.map((x) => (
              <div className="card" key={x.key}>
                <div className="row">
                  <NameBtn b={x} />
                  <div className="row">
                    <span className="amt">{rs(x.bal)}</span>
                    <button type="button" className="small" onClick={() => props.onSettle(x)}>
                      {t('khata.settle')}
                    </button>
                  </div>
                </div>
                <History b={x} />
              </div>
            ))
          ) : (
            <p className="empty">{t('khata.noCus')}</p>
          ))}
        {sub === 'maal' &&
          (() => {
            const groups = groupBySupplier(openReorders(entries, parties));
            if (!groups.length) return <p className="empty">{t('khata.noMaal')}</p>;
            return groups.map((g) => (
              <div key={g.supplier ?? '-'} className="group">
                <h3>{g.supplier ?? t('khata.noSupplier')}</h3>
                {g.items.map((i) => (
                  <div className="card row" key={i.key}>
                    <b>{i.item}</b>
                    <button type="button" className="small" onClick={() => props.onDone(i.ids, 'maal')}>
                      {t('khata.gotIt')}
                    </button>
                  </div>
                ))}
              </div>
            ));
          })()}
        {sub === 'ord' &&
          (() => {
            const o = openOrders(entries, parties);
            if (!o.length) return <p className="empty">{t('khata.noOrd')}</p>;
            return o.map((x) => (
              <div className="card row" key={x.id}>
                <div>
                  <b>{x.name ?? '?'}</b>
                  {x.item ? `: ${x.item}` : ''}
                  {x.amount ? ` · ${rs(x.amount)}` : ''}
                  {x.due && (
                    <>
                      <br />
                      <span className={`tag ${x.due < today ? 'late' : ''}`}>{fmt(x.due, today)}</span>
                    </>
                  )}
                </div>
                <button type="button" className="small" onClick={() => props.onDone([x.id], 'ord')}>
                  {t('khata.done')}
                </button>
              </div>
            ));
          })()}
      </div>
    </section>
  );
}
