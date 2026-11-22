// Swappable speech-to-text engines.
import type { Lang, WhisperSize } from '../../shared/types';
import { encodeWav } from './audio';
import { cleanTranscript } from './guards';
import { speechRatio, splitChunks, trimSilence } from './vad';

export interface SttEngine {
  id: string;
  isAvailable(): Promise<boolean>;
  supports(lang: Lang): boolean;
  transcribe(audio: Float32Array /* 16 kHz mono */, lang: Lang | 'auto'): Promise<{ text: string; confidence?: number }>;
  onPartial?(cb: (text: string) => void): void;
}

export class SttError extends Error {
  constructor(public status: number, msg: string) {
    super(msg);
  }
}

// ---------------- Online: Sarvam (via /api/transcribe) ----------------
let sarvamConfigured: boolean | null = null;
export function setSarvamConfigured(v: boolean) {
  sarvamConfigured = v;
}

export class SarvamEngine implements SttEngine {
  id = 'sarvam';
  dead = false; // set for the rest of the session after 402/429/errors
  async isAvailable() {
    return !this.dead && sarvamConfigured !== false && navigator.onLine;
  }
  supports() {
    return true;
  }
  async transcribe(audio: Float32Array, lang: Lang | 'auto') {
    const trimmed = trimSilence(audio);
    if (!trimmed.length) return { text: '' };
    const parts: string[] = [];
    for (const chunk of splitChunks(trimmed, 28)) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 8000 + chunk.length / 16); // 8 s + ~1 s per 16 s of audio
      let res: Response;
      try {
        res = await fetch(`/api/transcribe?lang=${lang}`, { method: 'POST', headers: { 'content-type': 'audio/wav' }, body: encodeWav(chunk), signal: ctl.signal });
      } catch {
        this.dead = true;
        throw new SttError(0, 'network');
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) {
        this.dead = true;
        if (res.status === 503) sarvamConfigured = false;
        throw new SttError(res.status, 'sarvam ' + res.status);
      }
      const body = await res.json();
      parts.push(String(body.text ?? ''));
    }
    return { text: cleanTranscript(parts.join(' ').trim(), 1) };
  }
}

// ---------------- Offline: Whisper in a Web Worker ----------------
export const WHISPER_MODELS: Record<WhisperSize, { id: string; mb: number }> = {
  tiny: { id: 'onnx-community/whisper-tiny', mb: 45 },
  base: { id: 'onnx-community/whisper-base', mb: 85 },
  small: { id: 'onnx-community/whisper-small', mb: 260 },
};
const WHISPER_LANG: Record<Lang, string> = { hi: 'hindi', en: 'english', mr: 'marathi', gu: 'gujarati' };

type Pending = { resolve: (v: unknown) => void; reject: (e: unknown) => void; onProgress?: (p: number) => void };

class WhisperWorker {
  private w: Worker | null = null;
  private seq = 0;
  private pending = new Map<number, Pending>();
  loaded: string | null = null;
  private get worker() {
    if (!this.w) {
      this.w = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' });
      this.w.onmessage = (ev) => {
        const { id, type, data } = ev.data;
        const p = this.pending.get(id);
        if (!p) return;
        if (type === 'progress') p.onProgress?.(data);
        else if (type === 'error') {
          this.pending.delete(id);
          p.reject(new Error(data));
        } else {
          this.pending.delete(id);
          p.resolve(data);
        }
      };
    }
    return this.w;
  }
  call<T>(msg: Record<string, unknown>, onProgress?: (p: number) => void, transfer: Transferable[] = []): Promise<T> {
    const id = ++this.seq;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onProgress });
      this.worker.postMessage({ id, ...msg }, transfer);
    });
  }
  async load(model: string, onProgress?: (p: number) => void) {
    if (this.loaded === model) return;
    await this.call({ type: 'load', model }, onProgress);
    this.loaded = model;
  }
}
export const whisperWorker = new WhisperWorker();

export async function isModelCached(model: string): Promise<boolean> {
  try {
    if (!('caches' in self)) return false;
    const c = await caches.open('transformers-cache');
    const keys = await c.keys();
    return keys.some((k) => k.url.includes(model) && /\.onnx/.test(k.url));
  } catch {
    return false;
  }
}

export async function removeModel(model: string): Promise<void> {
  const c = await caches.open('transformers-cache');
  for (const k of await c.keys()) if (k.url.includes(model)) await c.delete(k);
  if (whisperWorker.loaded === model) whisperWorker.loaded = null;
}

export class WhisperEngine implements SttEngine {
  id = 'whisper';
  constructor(public size: WhisperSize) {}
  get model() {
    return WHISPER_MODELS[this.size].id;
  }
  async isAvailable() {
    return isModelCached(this.model);
  }
  supports() {
    return true;
  }
  async transcribe(audio: Float32Array, lang: Lang | 'auto') {
    const trimmed = trimSilence(audio);
    const ratio = speechRatio(audio);
    if (!trimmed.length || ratio < 0.03) return { text: '' };
    await whisperWorker.load(this.model);
    const parts: string[] = [];
    for (const chunk of splitChunks(trimmed, 28)) {
      const copy = chunk.slice();
      const text = await whisperWorker.call<string>({ type: 'transcribe', audio: copy, language: lang === 'auto' ? null : WHISPER_LANG[lang] }, undefined, [copy.buffer]);
      parts.push(cleanTranscript(text, speechRatio(chunk)));
    }
    return { text: cleanTranscript(parts.join(' '), ratio) };
  }
}

// ---------------- Last resort: browser Web Speech API (live engine) ----------------
type SR = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
const SRClass = (): (new () => SR) | null => {
  const w = globalThis as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};
const BCP47: Record<Lang, string> = { hi: 'hi-IN', en: 'en-IN', mr: 'mr-IN', gu: 'gu-IN' };

export function webSpeechAvailable(): boolean {
  return !!SRClass();
}

export type LiveError = 'noPermission' | 'noMic' | 'browserService' | 'noSpeech' | 'failed';

/**
 * Live recogniser (browser Web Speech API): listens to the mic itself and streams partials.
 * Chrome sends this audio to Google; it is missing or broken in some browsers (Brave, Firefox, in-app
 * browsers), and Chrome desktop ends a session early on short pauses. So: restart until the owner stops,
 * and turn every failure into a specific, actionable error.
 */
export class WebSpeechLive {
  id = 'webspeech';
  private rec: SR | null = null;
  private finalText = '';
  private userStopped = false;
  private startedAt = 0;
  private langTried: string[] = [];
  start(lang: Lang | 'auto', onPartial: (t: string) => void, onEnd: (finalText: string, error?: LiveError) => void) {
    const C = SRClass();
    if (!C) return onEnd('', 'browserService');
    this.finalText = '';
    this.userStopped = false;
    this.startedAt = Date.now();
    const run = (bcp: string) => {
      const rec = new C();
      this.rec = rec;
      this.langTried.push(bcp);
      rec.lang = bcp;
      rec.continuous = true;
      rec.interimResults = true;
      let err: string | undefined;
      rec.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) this.finalText += ' ' + r[0].transcript;
          else interim += r[0].transcript;
        }
        onPartial((this.finalText + ' ' + interim).trim());
      };
      rec.onerror = (e) => {
        err = e.error;
      };
      rec.onend = () => {
        const text = this.finalText.trim();
        if (err === 'language-not-supported' && !this.langTried.includes('en-IN')) return run('en-IN');
        if (err === 'not-allowed' || err === 'service-not-allowed') return onEnd(text, err === 'not-allowed' ? 'noPermission' : 'browserService');
        if (err === 'audio-capture') return onEnd(text, 'noMic');
        if (err === 'network') return onEnd(text, 'browserService');
        // Ended with words heard = natural auto-stop. Ended with nothing yet (Chrome often stops early):
        // keep listening, up to 12 s, unless the owner tapped stop.
        const recoverable = err === undefined || err === 'no-speech';
        if (!text && recoverable && !this.userStopped && Date.now() - this.startedAt < 12000) {
          try {
            return run(bcp);
          } catch {
            /* fall through to the error below */
          }
        }
        if (text) return onEnd(text);
        onEnd('', err === undefined || err === 'no-speech' || err === 'aborted' ? 'noSpeech' : 'failed');
      };
      rec.start();
    };
    try {
      run(BCP47[lang === 'auto' ? 'hi' : lang]);
    } catch {
      onEnd('', 'failed');
    }
  }
  stop() {
    this.userStopped = true;
    this.rec?.stop();
  }
  abort() {
    this.userStopped = true;
    this.rec?.abort();
  }
}
