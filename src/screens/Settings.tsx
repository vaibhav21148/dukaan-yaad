import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGS, type Settings as S, type WhisperSize } from '../../shared/types';
import { CloseIcon } from '../components/Icons';
import { LANG_NAMES } from '../i18n';
import { isModelCached, removeModel, WHISPER_MODELS } from '../stt/engines';
import { downloadPack } from '../stt/session';

type PackState = 'none' | 'downloading' | 'ready';

export function Settings(props: {
  settings: S;
  hasDemo: boolean;
  installPrompt: (() => void) | null;
  onChange: (patch: Partial<S>) => void;
  onClose: () => void;
  onLoadDemo: () => void;
  onClearDemo: () => void;
  onWipe: () => void;
  onPacksChanged: () => void;
}) {
  const { t } = useTranslation();
  const { settings } = props;
  const [packs, setPacks] = useState<Record<WhisperSize, PackState>>({ tiny: 'none', base: 'none', small: 'none' });
  const [pct, setPct] = useState(0);
  const [ask, setAsk] = useState<WhisperSize | null>(null);
  const [wipeAsk, setWipeAsk] = useState(false);
  const [err, setErr] = useState('');
  const [usage, setUsage] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const next = { ...packs };
      for (const s of Object.keys(WHISPER_MODELS) as WhisperSize[]) next[s] = (await isModelCached(WHISPER_MODELS[s].id)) ? 'ready' : 'none';
      setPacks(next);
      try {
        const est = await navigator.storage?.estimate?.();
        if (est?.usage) setUsage(Math.round(est.usage / 1e6));
      } catch {
        /* optional */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const conn = (navigator as unknown as { connection?: { type?: string; saveData?: boolean; effectiveType?: string } }).connection;
  const onMobile = !!conn && (conn.type === 'cellular' || conn.saveData === true);

  const start = async (size: WhisperSize) => {
    setAsk(null);
    setErr('');
    setPacks((p) => ({ ...p, [size]: 'downloading' }));
    setPct(0);
    try {
      await downloadPack(size, setPct);
      setPacks((p) => ({ ...p, [size]: 'ready' }));
      props.onChange({ whisperModel: size });
      props.onPacksChanged();
    } catch (e) {
      setErr(String((e as Error)?.message ?? e));
      setPacks((p) => ({ ...p, [size]: 'none' }));
    }
  };

  return (
    <div className="settings" role="dialog" aria-modal="true" aria-labelledby="h-settings">
      <div className="wrap">
        <div className="row settings-top">
          <h2 id="h-settings">{t('settings.title')}</h2>
          <button type="button" className="icon-btn" onClick={props.onClose} aria-label={t('settings.close')}>
            <CloseIcon />
          </button>
        </div>

        <div className="card">
          <label className="field">
            {t('settings.lang')}
            <select value={settings.lang} onChange={(e) => props.onChange({ lang: e.target.value as S['lang'] })}>
              {LANGS.map((l) => (
                <option key={l} value={l}>
                  {LANG_NAMES[l]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            {t('settings.sttLang')}
            <select value={settings.sttLang} onChange={(e) => props.onChange({ sttLang: e.target.value as S['sttLang'] })}>
              <option value="auto">{t('settings.sttAuto')}</option>
              {LANGS.map((l) => (
                <option key={l} value={l}>
                  {LANG_NAMES[l]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            {t('settings.autoStop')}
            <select value={settings.autoStopMs} onChange={(e) => props.onChange({ autoStopMs: Number(e.target.value) })}>
              {[1500, 2000, 3000, 4000].map((ms) => (
                <option key={ms} value={ms}>
                  {t('settings.seconds', { n: ms / 1000 })}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.onlineAi} onChange={(e) => props.onChange({ onlineAi: e.target.checked })} />
            <span>
              {t('settings.onlineAi')}
              <br />
              <span className="note-s">{t('settings.onlineAiHint')}</span>
            </span>
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.readAloud} onChange={(e) => props.onChange({ readAloud: e.target.checked })} />
            <span>{t('settings.readAloud')}</span>
          </label>
          <label className="field">
            {t('settings.theme')}
            <select value={settings.theme} onChange={(e) => props.onChange({ theme: e.target.value as S['theme'] })}>
              <option value="system">{t('settings.themeSystem')}</option>
              <option value="light">{t('settings.themeLight')}</option>
              <option value="dark">{t('settings.themeDark')}</option>
            </select>
          </label>
        </div>

        <h3>{t('settings.packs')}</h3>
        <p className="note-s">{t('settings.packsHint')}</p>
        {(Object.keys(WHISPER_MODELS) as WhisperSize[]).map((size) => {
          const st = packs[size];
          const mb = WHISPER_MODELS[size].mb;
          const label = t(size === 'tiny' ? 'settings.packTiny' : size === 'base' ? 'settings.packBase' : 'settings.packSmall');
          return (
            <div className="card" key={size}>
              <div className="row">
                <div>
                  <b>{label}</b>
                  <br />
                  <span className="note-s">{t('settings.packSize', { mb })}</span>
                </div>
                {st === 'none' && (
                  <button type="button" className="small" onClick={() => setAsk(size)} disabled={Object.values(packs).includes('downloading')}>
                    {t('settings.download')}
                  </button>
                )}
                {st === 'downloading' && (
                  <span className="note-s" aria-live="polite">
                    {t('settings.downloading', { pct })}
                  </span>
                )}
                {st === 'ready' && (
                  <div className="acts m0">
                    {settings.whisperModel === size ? (
                      <span className="tag ok">{t('settings.inUse')}</span>
                    ) : (
                      <button type="button" className="small" onClick={() => props.onChange({ whisperModel: size })}>
                        {t('settings.useThis')}
                      </button>
                    )}
                    <button
                      type="button"
                      className="small"
                      onClick={async () => {
                        await removeModel(WHISPER_MODELS[size].id);
                        setPacks((p) => ({ ...p, [size]: 'none' }));
                        props.onPacksChanged();
                      }}
                    >
                      {t('settings.remove')}
                    </button>
                  </div>
                )}
              </div>
              {st === 'downloading' && <progress max={100} value={pct} aria-label={t('settings.downloading', { pct })} />}
              {ask === size && (
                <div className="dlg">
                  {onMobile ? t('settings.mobileData', { mb }) : t('settings.confirmDownload', { mb })}
                  <div className="acts">
                    <button type="button" className="small sel" onClick={() => start(size)}>
                      {t('settings.yes')}
                    </button>
                    <button type="button" className="small" onClick={() => setAsk(null)}>
                      {t('settings.no')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {err && <p className="status warn">{err}</p>}

        <h3>{t('settings.demo')}</h3>
        <div className="card acts">
          <button type="button" className="small" onClick={props.onLoadDemo}>
            {t('settings.demoLoad')}
          </button>
          {props.hasDemo && (
            <button type="button" className="small" onClick={props.onClearDemo}>
              {t('settings.demoClear')}
            </button>
          )}
        </div>

        {props.installPrompt && (
          <div className="card">
            <button type="button" className="small sel" onClick={props.installPrompt}>
              {t('settings.install')}
            </button>
          </div>
        )}

        <div className="card">
          <p className="m0">
            <b>{t('settings.privacy')}</b>
          </p>
          <p className="note-s">{t('settings.privacyMore')}</p>
          {usage != null && <p className="note-s">{t('settings.storage', { mb: usage })}</p>}
          {!wipeAsk ? (
            <button type="button" onClick={() => setWipeAsk(true)}>
              {t('settings.wipe')}
            </button>
          ) : (
            <div className="dlg" role="alert">
              {t('settings.wipeConfirm')}
              <div className="acts">
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    setWipeAsk(false);
                    props.onWipe();
                  }}
                >
                  {t('settings.wipeYes')}
                </button>
                <button type="button" onClick={() => setWipeAsk(false)}>
                  {t('settings.wipeNo')}
                </button>
              </div>
            </div>
          )}
        </div>
        <p className="note-s center">{t('settings.about')}</p>
      </div>
    </div>
  );
}
