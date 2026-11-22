import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ENTRY_TYPES, type DraftEntry, type Lang, type Party } from '../../shared/types';
import { Badge, Icon, TYPE_ICON } from '../components/Icons';
import { chooseParty, NEW_PARTY, resolveParty, type Sides } from '../domain/drafts';
import type { CurrentDraft } from '../db/db';
import { rs } from '../lib/hooks';

export function Review(props: {
  draft: CurrentDraft;
  parties: Party[];
  sides: Sides;
  today: string;
  fmtDate: (d: string | null, today: string) => string;
  lang: Lang;
  canReonline: boolean;
  busy: boolean;
  onChange: (entries: DraftEntry[]) => void;
  onSave: () => void;
  onDiscard: () => void;
  onReonline: () => void;
}) {
  const { t } = useTranslation();
  const { draft, parties, lang } = props;
  const list = draft.entries;
  const byId = useMemo(() => new Map(parties.map((p) => [p.id, p])), [parties]);
  const choiceCount = list.filter((e) => e.choices?.length).length;
  const unresolved = choiceCount > 0;
  const [editing, setEditing] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setEditing((s0) => {
      const n = new Set(s0);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const audioUrl = useMemo(() => (draft.audio ? URL.createObjectURL(draft.audio) : null), [draft.audio]);

  const set = (i: number, patch: Partial<DraftEntry>) => {
    const next = [...list];
    let d = { ...next[i], ...patch };
    if ('party' in patch || 'type' in patch) d = resolveParty({ ...d, forceNew: false }, parties, lang, props.sides);
    // a value the owner typed is no longer a doubt about that field
    if ('amount' in patch && patch.amount != null && d.unclear && /kitna|kitne|how much|किती|કેટલ|rakam|amount|रक्कम|રકમ/i.test(d.unclear)) d.unclear = null;
    next[i] = d;
    props.onChange(next);
  };
  const del = (i: number) => props.onChange(list.filter((_, j) => j !== i));
  const pick = (i: number, id: string) => {
    const next = [...list];
    next[i] = chooseParty(next[i], id, parties);
    props.onChange(next);
  };
  const countText = list.length ? t('journey.found', { count: list.length }) + (unresolved ? ' · ' + t('journey.needChoice', { count: choiceCount }) : '') : '';

  return (
    <section aria-labelledby="h-review" className="review">
      <div className="review-head">
        <h2 id="h-review">{t('review.title')}</h2>
        {countText && <p className={`review-count ${unresolved ? 'warn' : ''}`}>{countText}</p>}
      </div>
      <div className="card note-card">
        <Badge name="mic" />
        <div>
          <div className="note-meta">
            <span>{t('review.noteText')}</span>
            <span>{t(`review.by.${draft.by}`)}</span>
          </div>
          <div>{draft.text}</div>
          {audioUrl && <audio controls src={audioUrl} aria-label={t('review.listenAgain')} className="audio" />}
        </div>
      </div>
      {props.canReonline && (
        <div className="dlg">
          <p className="m0">{t('review.reonlineHint')}</p>
          <button type="button" className="small sel" onClick={props.onReonline} disabled={props.busy}>
            {t('review.reonline')}
          </button>
        </div>
      )}
      {!list.length && <p className="empty">{t('review.none')}</p>}
      {list.map((e, i) => {
        const linked = e.partyId ? byId.get(e.partyId) : null;
        const doubt = [e.choiceQuestion, e.unclear].filter(Boolean).join(' ');
        // cards with a doubt (other than "which person") open for editing; clean cards stay a short summary
        const open = editing.has(e.key) || (!!e.unclear && !e.choices);
        return (
          <div className={`card entry ${doubt ? 'has-doubt' : ''}`} key={e.key}>
            <div className="entry-head">
              <Badge name={TYPE_ICON[e.type]} />
              <span className="entry-type">{t(`types.${e.type}`)}</span>
              <div className="entry-tools">
                <button type="button" className="tool" aria-expanded={open} onClick={() => toggle(e.key)} aria-label={open ? t('review.doneEdit') : t('review.edit')} title={open ? t('review.doneEdit') : t('review.edit')}>
                  <Icon name={open ? 'check' : 'pencil'} />
                </button>
                <button type="button" className="tool" onClick={() => del(i)} aria-label={t('review.removeLabel')} title={t('review.remove')}>
                  <Icon name="trash" />
                </button>
              </div>
            </div>
            {!open && (
              <div className="summary">
                <div className="row">
                  <b className="sum-name">{e.party ?? e.item ?? '?'}</b>
                  {e.amount != null && <span className="amt">{rs(e.amount)}</span>}
                </div>
                {e.party && e.item && <div className="sum-item">{e.item}</div>}
                {e.due && (
                  <span className={`tag ${e.due < props.today ? 'late' : ''}`}>
                    <Icon name="today" />
                    {props.fmtDate(e.due, props.today)}
                  </span>
                )}
              </div>
            )}
            {open && (
              <div className="grid">
                <label>
                  {t('review.fields.type')}
                  <select value={e.type} onChange={(ev) => set(i, { type: ev.target.value as DraftEntry['type'] })}>
                    {ENTRY_TYPES.map((k) => (
                      <option key={k} value={k}>
                        {t(`types.${k}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('review.fields.party')}
                  <input value={e.party ?? ''} placeholder={t('review.fields.who')} onChange={(ev) => set(i, { party: ev.target.value || null })} autoComplete="off" />
                </label>
                <label>
                  {t('review.fields.amount')}
                  <input
                    inputMode="numeric"
                    value={e.amount ?? ''}
                    placeholder="-"
                    onChange={(ev) => {
                      const v = ev.target.value.replace(/[^\d.]/g, '');
                      set(i, { amount: v === '' ? null : Number(v) });
                    }}
                  />
                </label>
                <label>
                  {t('review.fields.due')}
                  <input type="date" value={e.due ?? ''} onChange={(ev) => set(i, { due: ev.target.value || null })} />
                </label>
                <label className="full">
                  {t('review.fields.item')}
                  <input value={e.item ?? ''} placeholder="-" onChange={(ev) => set(i, { item: ev.target.value || null })} autoComplete="off" />
                </label>
              </div>
            )}
            {linked && !e.choices && (
              <div className="linked">
                <Icon name="check" />
                {t('review.linked', { name: linked.name })}
              </div>
            )}
            {doubt && (
              <div className="doubt">
                <Icon name="help" />
                <div>
                  <p>{doubt}</p>
                  {e.choices && (
                    <div className="acts">
                      {e.choices.map((c) => (
                        <button type="button" className="choice" key={c.partyId} onClick={() => pick(i, c.partyId)}>
                          <Icon name="person" />
                          {c.name}
                        </button>
                      ))}
                      <button type="button" className="choice" onClick={() => pick(i, NEW_PARTY)}>
                        + {t('review.newPerson')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            {e.quote && <div className="quote">“{e.quote}”</div>}
          </div>
        );
      })}
      <div className="savebar">
        <div className="wrap">
          <button type="button" className="ghost-btn" onClick={props.onDiscard} disabled={props.busy}>
            {t('review.discard')}
          </button>
          <button type="button" className="save" onClick={props.onSave} disabled={props.busy || unresolved || !list.length}>
            <Icon name="check" />
            {unresolved ? t('journey.chooseShort') : t('review.save')}
          </button>
        </div>
      </div>
    </section>
  );
}
