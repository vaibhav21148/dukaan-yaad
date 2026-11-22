import { useTranslation } from 'react-i18next';
import { MicButton } from '../components/MicButton';
import { Icon, SpeakerIcon } from '../components/Icons';
import type { VoiceState } from '../stt/session';

const VOICE_LANG: Record<string, string> = { hi: 'hi-IN', en: 'en-IN', mr: 'mr-IN', gu: 'gu-IN' };

export function speak(text: string, lang: string) {
  try {
    const s = window.speechSynthesis;
    if (!s) return;
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = VOICE_LANG[lang] ?? 'hi-IN';
    u.rate = 0.95;
    s.speak(u);
  } catch {
    /* read-aloud is optional */
  }
}

export function Ask(props: {
  lang: string;
  answer: string | null;
  busy: boolean;
  voice: VoiceState;
  level: number;
  partial: string;
  question: string;
  setQuestion: (q: string) => void;
  onAsk: (q: string) => void;
  onMicStart: () => void;
  onMicStop: () => void;
}) {
  const { t } = useTranslation();
  const [q, setQ] = [props.question, props.setQuestion];
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const submit = () => q.trim() && props.onAsk(q.trim());
  return (
    <section aria-labelledby="h-ask">
      <h2 id="h-ask">
        <Icon name="ask" />
        {t('ask.title')}
      </h2>
      <p className="note-s">{t('ask.hint')}</p>
      <div className="card ask-card">
        <div className="ask-mic">
          <MicButton state={props.voice} level={props.level} onStart={props.onMicStart} onStop={props.onMicStop} size="small" label={t('ask.micLabel')} />
          <span className="ask-state" aria-live="polite">
            {props.voice === 'listening' ? props.partial || t('mic.listening') : props.voice === 'thinking' ? t('mic.thinking') : t('ask.micLabel')}
          </span>
        </div>
        <form
          className="ask-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('ask.placeholder')} aria-label={t('ask.placeholder')} enterKeyHint="search" />
          <button type="submit" className="small sel" disabled={props.busy || !q.trim()}>
            {t('ask.go')}
          </button>
        </form>
      </div>
      <div aria-live="polite">
        {props.busy && <p className="empty">{t('ask.thinking')}</p>}
        {props.answer && !props.busy && (
          <div className="card ans">
            <div className="ans-text">{props.answer}</div>
            {canSpeak && (
              <button type="button" className="small" onClick={() => speak(props.answer!, props.lang)}>
                <SpeakerIcon /> {t('ask.speak')}
              </button>
            )}
          </div>
        )}
      </div>
      {(
        <div className="examples">
          <p className="say-label">{t('ask.examples')}</p>
          <div className="phrases">
            {(['ex1', 'ex2', 'ex3', 'ex4'] as const).map((k) => (
              <button
                type="button"
                key={k}
                className="phrase"
                onClick={() => {
                  setQ(t(`ask.${k}`));
                  props.onAsk(t(`ask.${k}`));
                }}
              >
                <Icon name="ask" />
                {t(`ask.${k}`)}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
