import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Undo } from '../db/repo';
import { Icon } from './Icons';

export interface ToastMsg {
  id: number;
  text: string;
  undo?: Undo;
}

/** Bottom toast; when it carries an Undo, the "Wapas lo" button stays for 10 seconds. */
export function Toast({ msg, onClose, onUndone }: { msg: ToastMsg | null; onClose: () => void; onUndone: () => void }) {
  const { t } = useTranslation();
  const [left, setLeft] = useState(10);
  useEffect(() => {
    if (!msg) return;
    setLeft(10);
    const start = Date.now();
    const i = setInterval(() => {
      const s = 10 - Math.floor((Date.now() - start) / 1000);
      setLeft(s);
      if (s <= 0) {
        clearInterval(i);
        onClose();
      }
    }, 250);
    return () => clearInterval(i);
  }, [msg, onClose]);
  if (!msg) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      <span>
        <Icon name="check" />
        {msg.text}
      </span>
      {msg.undo && (
        <button
          type="button"
          className="small"
          onClick={async () => {
            await msg.undo!.revert();
            onUndone();
          }}
        >
          {t('toast.undo')} ({left})
        </button>
      )}
    </div>
  );
}
