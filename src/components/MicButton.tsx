import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { VoiceState } from '../stt/session';
import { MicIcon, StopIcon } from './Icons';

/**
 * Tap to start, tap to stop. Also press-and-hold: hold > 450 ms and release to stop.
 */
export function MicButton(props: { state: VoiceState; level: number; onStart: () => void; onStop: () => void; size?: 'big' | 'small'; label?: string }) {
  const { t } = useTranslation();
  const downAt = useRef(0);
  const startedByThisPress = useRef(false);
  const { state } = props;
  const listening = state === 'listening';
  const busy = state === 'thinking';

  const onPointerDown = (e: React.PointerEvent) => {
    if (busy || e.button > 0) return;
    downAt.current = Date.now();
    if (!listening) {
      startedByThisPress.current = true;
      props.onStart();
    } else startedByThisPress.current = false;
  };
  const onPointerUp = () => {
    if (busy) return;
    const held = Date.now() - downAt.current;
    if (startedByThisPress.current) {
      if (held > 450) props.onStop(); // press-and-hold released
    } else props.onStop(); // second tap
    startedByThisPress.current = false;
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (busy) return;
      if (listening) props.onStop();
      else props.onStart();
    }
  };
  const ring = listening ? 6 + Math.round(props.level * 22) : 0;
  return (
    <button
      type="button"
      className={`mic ${props.size === 'small' ? 'mic-sm' : ''} ${listening ? 'on' : ''} ${busy ? 'busy' : ''}`}
      aria-label={props.label ?? (listening ? t('mic.stop') : t('mic.start'))}
      aria-pressed={listening}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={() => {
        if (startedByThisPress.current && listening && Date.now() - downAt.current > 450) onPointerUp();
      }}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={onKey}
      style={{ ['--ring' as string]: `${ring}px` }}
      disabled={busy}
    >
      {listening ? <StopIcon /> : <MicIcon />}
    </button>
  );
}
