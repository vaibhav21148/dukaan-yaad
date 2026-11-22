import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGS, type DraftEntry, type Lang, type Settings as S } from '../shared/types';
import { ask as askQuestion } from './ask';
import { GearIcon, KeyboardIcon } from './components/Icons';
import { MicButton } from './components/MicButton';
import { Toast, type ToastMsg } from './components/Toast';
import { db, putSettings, type CurrentDraft } from './db/db';
import { clearDemo, hasDemo as hasDemoFn, markDone, markPaid, markSettled, saveNote, wipeAll, type Undo } from './db/repo';
import { demoExtraction, loadDemoLedger } from './domain/demo';
import { toDrafts, type Sides } from './domain/drafts';
import { customerCredit, partySide, snapshot, supplierDues, total, type Balance } from './domain/ledger';
import { pruneCache, understand } from './extract';
import type { KnownParty } from './extract/offline/parser';
import i18n, { HTML_LANG, LANG_NAMES } from './i18n';
import { fetchWithTimeout } from './lib/hash';
import { rs, useData, useFmtDate, useOnline, useToday } from './lib/hooks';
import { Ask, speak } from './screens/Ask';
import { Home } from './screens/Home';
import { Khata } from './screens/Khata';
import { Review } from './screens/Review';
import { Settings } from './screens/Settings';
import { setSarvamConfigured } from './stt/engines';
import { chooseEngine, VoiceSession, type EngineId, type VoiceState } from './stt/session';

type Tab = 'home' | 'khata' | 'ask';
interface Health {
  llm: boolean;
  stt: boolean;
}

let toastSeq = 0;

export default function App({ installPrompt }: { installPrompt: () => (() => void) | null }) {
  const { t } = useTranslation();
  const data = useData();
  const { entries, parties, notes, settings, draft } = data;
  const today = useToday();
  const online = useOnline();
  const lang = settings.lang;

  const [tab, setTab] = useState<Tab>('home');
  const [showSettings, setShowSettings] = useState(false);
  const [voice, setVoice] = useState<VoiceState>('idle');
  const [voiceFor, setVoiceFor] = useState<'note' | 'ask'>('note');
  const [level, setLevel] = useState(0);
  const [partial, setPartial] = useState('');
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatusText] = useState('');
  const [statusAction, setStatusAction] = useState<'pack' | null>(null);
  const setStatus = (text: string, action: 'pack' | null = null) => {
    setStatusText(text);
    setStatusAction(action);
  };
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [health, setHealth] = useState<Health & { checked: boolean }>({ llm: false, stt: false, checked: false });
  const [engine, setEngine] = useState<EngineId>('typing');
  const [packsTick, setPacksTick] = useState(0);
  const [demoOn, setDemoOn] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [askBusy, setAskBusy] = useState(false);
  const session = useRef<VoiceSession | null>(null);

  // ---- language, theme ----
  useEffect(() => {
    void i18n.changeLanguage(lang);
    document.documentElement.lang = HTML_LANG[lang] ?? 'hi';
  }, [lang]);
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
  }, [settings.theme]);

  // ---- server capabilities (which free keys are configured) ----
  useEffect(() => {
    if (!online) return;
    fetchWithTimeout('/api/health', {}, 4000)
      .then((r) => (r.ok ? r.json() : { llm: false, stt: false }))
      .then((h: Health) => {
        setSarvamConfigured(!!h.stt);
        setHealth({ llm: !!h.llm, stt: !!h.stt, checked: true });
      })
      .catch(() => {
        setSarvamConfigured(false);
        setHealth({ llm: false, stt: false, checked: true });
      });
  }, [online]);
  useEffect(() => {
    void chooseEngine(settings.whisperModel).then(setEngine);
  }, [online, health, settings.whisperModel, packsTick, voice]);
  useEffect(() => {
    void hasDemoFn().then(setDemoOn);
  }, [entries.length]);
  useEffect(() => {
    void pruneCache();
  }, []);

  const aiOn = settings.onlineAi && online && health.llm;
  const knownParties = useCallback(
    (): KnownParty[] => parties.map((p) => ({ name: p.name, aliases: p.aliases, side: partySide(entries, p.id) })),
    [parties, entries],
  );
  const sidesOf = (es = entries, ps = parties): Sides => Object.fromEntries(ps.map((p) => [p.id, partySide(es, p.id)]));
  const fmtDate = useFmtDate();
  const showToast = (text: string, undo?: Undo) => setToast({ id: ++toastSeq, text, undo });
  const closeToast = useCallback(() => setToast(null), []);

  // ---- understanding a note (voice or typed) ----
  const handleNote = async (text: string, stt: string | null, audio: Blob | null) => {
    const clean = text.trim();
    if (!clean) return setStatus(t('type.empty'));
    setBusy(true);
    setStatus('');
    try {
      const r = await understand(clean, { lang, today, parties: knownParties(), online: aiOn });
      if (r.reason === 'ai-failed') setStatus(t('status.aiFailed'));
      if (r.reason === 'no-network' && settings.onlineAi && health.llm) setStatus(t('status.offlineAi'));
      const fresh = toDrafts(r.entries, clean, parties, lang, sidesOf());
      const cur = await db.drafts.get('current');
      const next: CurrentDraft = cur
        ? { ...cur, text: `${cur.text} ${clean}`, entries: [...cur.entries, ...fresh], offlineParsed: cur.offlineParsed || r.offline, audio: cur.audio ?? audio, stt: cur.stt ?? stt }
        : { id: 'current', text: clean, entries: fresh, by: r.by, stt, audio, offlineParsed: r.offline, createdAt: new Date().toISOString() };
      await db.drafts.put(next);
      setTyped('');
      setTyping(false);
      setTab('home');
    } finally {
      setBusy(false);
    }
  };

  const reonline = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const r = await understand(draft.text, { lang, today, parties: knownParties(), online: true });
      if (r.offline) return setStatus(t('status.aiFailed'));
      await db.drafts.put({ ...draft, entries: toDrafts(r.entries, draft.text, parties, lang, sidesOf()), by: r.by, offlineParsed: false });
    } finally {
      setBusy(false);
    }
  };

  // ---- voice ----
  const startVoice = (target: 'note' | 'ask') => {
    setStatus('');
    setPartial('');
    setVoiceFor(target);
    const s = new VoiceSession(
      {
        onState: setVoice,
        onLevel: setLevel,
        onPartial: setPartial,
        onDone: ({ text, engine: eng, audio }) => {
          setPartial('');
          if (target === 'ask') {
            setQuestion(text);
            void doAsk(text);
          } else void handleNote(text, eng, audio);
        },
        onError: (k) => {
          setPartial('');
          setStatus(t(`mic.${k}`), k === 'browserService' || k === 'unavailable' ? 'pack' : null);
          if (k === 'unavailable' || k === 'browserService') setTyping(true);
        },
        onFallback: () => setStatus(t('status.sttFallback')),
      },
      { lang: settings.sttLang, uiLang: lang, autoStopMs: settings.autoStopMs, whisperSize: settings.whisperModel },
    );
    session.current = s;
    void s.start();
  };
  const stopVoice = () => void session.current?.stop();

  // ---- ask ----
  const doAsk = async (q: string) => {
    setAskBusy(true);
    try {
      const r = await askQuestion(q, snapshot(entries, parties, today), lang, aiOn);
      setAnswer(r.answer);
      if (settings.readAloud) speak(r.answer, lang);
    } finally {
      setAskBusy(false);
    }
  };

  // ---- demo ----
  const tryExample = async () => {
    if (!(await hasDemoFn())) await loadDemoLedger(lang, today);
    const all = await db.parties.toArray();
    const allEntries = await db.entries.toArray();
    const ex = demoExtraction(lang, today);
    await db.drafts.put({ id: 'current', text: ex.text, entries: toDrafts(ex.entries, ex.text, all, lang, sidesOf(allEntries, all)), by: 'demo', stt: null, audio: null, offlineParsed: false, createdAt: new Date().toISOString() });
    setShowSettings(false);
    setTab('home');
    setStatus(t('example.loaded'));
    setDemoOn(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ---- one-tap actions with undo ----
  const withUndo = async (p: Promise<Undo>, text: string) => showToast(text, await p);
  const onPaid = (b: Balance) => withUndo(markPaid(b), t('toast.paid'));
  const onSettle = (b: Balance) => withUndo(markSettled(b), t('toast.settled'));
  const onDone = (ids: string[]) => withUndo(markDone(ids), t('toast.done'));

  const save = async () => {
    if (!draft) return;
    const u = await saveNote({ text: draft.text, entries: draft.entries, by: draft.by, stt: draft.stt, lang, demo: draft.by === 'demo' });
    setStatus('');
    showToast(t('toast.saved'), u);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const discard = async () => {
    await db.drafts.delete('current');
    setStatus(t('toast.discarded'));
  };
  const changeDraft = (list: DraftEntry[]) => draft && db.drafts.put({ ...draft, entries: list });
  const changeSettings = (patch: Partial<S>) => void putSettings(patch);

  const sups = supplierDues(entries, parties);
  const cus = customerCredit(entries, parties);

  if (!data.ready) return null;

  if (!settings.onboarded) {
    return (
      <main className="onboard">
        <div className="wrap">
          <p className="brand">{t('app.name')}</p>
          <h1>{t('app.tagline')}</h1>
          <h2>{t('onboard.title')}</h2>
          <p className="note-s">{t('onboard.sub')}</p>
          <div className="lang-grid">
            {LANGS.map((l: Lang) => (
              <button type="button" key={l} className="lang-btn" lang={HTML_LANG[l]} onClick={() => changeSettings({ lang: l, onboarded: true })}>
                {LANG_NAMES[l]}
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  const chipStt = { sarvam: t('chip.online'), whisper: t('chip.offlinePack'), webspeech: t('chip.browser'), typing: t('chip.typing') }[engine];
  const micText = voice === 'listening' ? t('mic.listening') : voice === 'thinking' || busy ? t('mic.thinking') : draft ? t('mic.more') : t('mic.idle');
  const noteVoice = voiceFor === 'note' ? voice : 'idle';
  const askVoice = voiceFor === 'ask' ? voice : 'idle';

  return (
    <>
      <header className="masthead">
        <div className="wrap">
          <div className="bar">
            <span className="brand">{t('app.name')}</span>
            <div className="chips">
              <span className="chip">{chipStt}</span>
              {!aiOn && <span className="chip quiet">{t('chip.offlineMode')}</span>}
              <button type="button" className="icon-btn" onClick={() => setShowSettings(true)} aria-label={t('settings.open')}>
                <GearIcon />
              </button>
            </div>
          </div>
          <dl className="totals">
            <div>
              <dt>{t('totals.milna')}</dt>
              <dd data-testid="total-milna">{rs(total(cus))}</dd>
            </div>
            <div>
              <dt>{t('totals.dena')}</dt>
              <dd data-testid="total-dena">{rs(total(sups))}</dd>
            </div>
          </dl>
        </div>
      </header>

      <main className="page" id="main">
        <div className="wrap">
          {tab === 'home' && (
            <section className={`talk ${draft ? 'compact' : ''}`} aria-label={t('mic.start')}>
              <div className="talk-main">
                <MicButton state={busy && noteVoice === 'idle' ? 'thinking' : noteVoice} level={level} onStart={() => startVoice('note')} onStop={stopVoice} label={draft ? t('review.addMore') : undefined} size={draft ? 'small' : 'big'} />
                <p className="mic-state" aria-live="polite">
                  {micText}
                </p>
              </div>
              <p className="partial" aria-live="polite">
                {voiceFor === 'note' ? partial : ''}
              </p>
              {!entries.length && !draft && !partial && <p className="hint">{t('mic.hint')}</p>}
              <div className="acts center">
                <button type="button" className="text-btn" aria-expanded={typing} onClick={() => setTyping(!typing)}>
                  <KeyboardIcon /> {typing ? t('type.close') : t('type.open')}
                </button>
                {!draft && (
                  <button type="button" className="text-btn" onClick={tryExample}>
                    {t('example.try')}
                  </button>
                )}
              </div>
              {typing && (
                <form
                  className="typed"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleNote(typed, null, null);
                  }}
                >
                  <textarea value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t('type.placeholder')} aria-label={t('type.open')} autoFocus />
                  <button type="submit" className="btn" disabled={busy}>
                    {t('type.go')}
                  </button>
                </form>
              )}
            </section>
          )}
          {status && (
            <div className="status" role="status" aria-live="polite">
              <span>{status}</span>
              {statusAction === 'pack' && (
                <button type="button" className="text-btn" onClick={() => setShowSettings(true)}>
                  {t('mic.getPack')}
                </button>
              )}
            </div>
          )}
          {tab === 'home' && draft && (
            <Review
              draft={draft}
              parties={parties}
              sides={sidesOf()}
              today={today}
              fmtDate={fmtDate}
              lang={lang}
              canReonline={draft.offlineParsed && aiOn}
              busy={busy}
              onChange={changeDraft}
              onSave={save}
              onDiscard={discard}
              onReonline={reonline}
            />
          )}
          {tab === 'home' && !draft && <Home entries={entries} parties={parties} notes={notes} today={today} />}
          {tab === 'khata' && <Khata entries={entries} parties={parties} today={today} onPaid={onPaid} onSettle={onSettle} onDone={onDone} />}
          {tab === 'ask' && (
            <Ask
              lang={lang}
              answer={answer}
              busy={askBusy}
              voice={askVoice}
              level={level}
              partial={voiceFor === 'ask' ? partial : ''}
              question={question}
              setQuestion={setQuestion}
              onAsk={doAsk}
              onMicStart={() => startVoice('ask')}
              onMicStop={stopVoice}
            />
          )}
        </div>
      </main>

      <nav aria-label="Main">
        <div className="wrap">
          {(['home', 'khata', 'ask'] as Tab[]).map((k) => (
            <button
              type="button"
              key={k}
              aria-current={tab === k ? 'page' : undefined}
              onClick={() => {
                if (voice === 'listening') session.current?.cancel();
                setTab(k);
                setStatus('');
                window.scrollTo({ top: 0 });
              }}
            >
              {t(`nav.${k}`)}
            </button>
          ))}
        </div>
      </nav>

      <Toast msg={toast} onClose={closeToast} onUndone={() => setToast({ id: ++toastSeq, text: t('toast.undone') })} />

      {showSettings && (
        <Settings
          settings={settings}
          hasDemo={demoOn}
          installPrompt={installPrompt()}
          onChange={changeSettings}
          onClose={() => setShowSettings(false)}
          onLoadDemo={tryExample}
          onClearDemo={async () => {
            await clearDemo();
            if (draft?.by === 'demo') await db.drafts.delete('current');
            setDemoOn(false);
            showToast(t('toast.demoCleared'));
          }}
          onWipe={async () => {
            await wipeAll();
            setShowSettings(false);
            showToast(t('toast.wiped'));
          }}
          onPacksChanged={() => setPacksTick((x) => x + 1)}
        />
      )}
    </>
  );
}
