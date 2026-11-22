// One recording session: mic -> 16 kHz PCM -> VAD (auto-stop, segmenting) -> engine -> text.
// Engine choice: Sarvam (online) -> Whisper offline pack -> browser Web Speech -> typing.
import type { Lang, WhisperSize } from '../../shared/types';
import { concat, Downsampler, encodeWav, SR } from './audio';
import { SarvamEngine, SttError, WebSpeechLive, webSpeechAvailable, WHISPER_MODELS, whisperWorker, WhisperEngine, type SttEngine } from './engines';
import { EnergyVad, hasSpeech } from './vad';

export type EngineId = 'sarvam' | 'whisper' | 'webspeech' | 'typing';
export type VoiceState = 'idle' | 'listening' | 'thinking';

export interface SessionCallbacks {
  onState(s: VoiceState): void;
  onLevel(level: number): void; // 0..1
  onPartial(text: string): void;
  onDone(r: { text: string; engine: EngineId; audio: Blob | null }): void;
  onError(key: 'noPermission' | 'failed' | 'noSpeech' | 'unavailable'): void;
  onFallback?(from: EngineId, to: EngineId): void;
}

const sarvam = new SarvamEngine();
const whisperBySize = new Map<WhisperSize, WhisperEngine>();
const whisper = (s: WhisperSize) => {
  if (!whisperBySize.has(s)) whisperBySize.set(s, new WhisperEngine(s));
  return whisperBySize.get(s)!;
};

export async function chooseEngine(size: WhisperSize): Promise<EngineId> {
  if (await sarvam.isAvailable()) return 'sarvam';
  if (await whisper(size).isAvailable()) return 'whisper';
  if (webSpeechAvailable() && navigator.onLine) return 'webspeech';
  return 'typing';
}
export const markSarvamDead = () => (sarvam.dead = true);

const WORKLET = `class C extends AudioWorkletProcessor{constructor(){super();this.b=[];this.n=0}process(i){const c=i[0]&&i[0][0];if(c){this.b.push(c.slice(0));this.n+=c.length;if(this.n>=2048){const o=new Float32Array(this.n);let p=0;for(const x of this.b){o.set(x,p);p+=x.length}this.port.postMessage(o,[o.buffer]);this.b=[];this.n=0}}return true}}registerProcessor('dy-capture',C);`;

export class VoiceSession {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioNode | null = null;
  private chunks: Float32Array[] = [];
  private total = 0;
  private committed = 0; // samples already sent for transcription
  private segTexts: string[] = [];
  private chain: Promise<void> = Promise.resolve();
  private vad = new EnergyVad();
  private heardSpeech = false;
  private settleChecked = false;
  private silenceMs = 0;
  private stopped = false;
  private live: WebSpeechLive | null = null;
  private engineId: EngineId = 'typing';
  private engine: SttEngine | null = null;
  private maxTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private cb: SessionCallbacks,
    private opts: { lang: Lang | 'auto'; uiLang: Lang; autoStopMs: number; whisperSize: WhisperSize; maxMs?: number },
  ) {}

  get engineUsed() {
    return this.engineId;
  }

  async start(): Promise<void> {
    this.engineId = await chooseEngine(this.opts.whisperSize);
    if (this.engineId === 'typing') return this.cb.onError('unavailable');
    if (this.engineId === 'webspeech') return this.startLive();
    this.engine = this.engineId === 'sarvam' ? sarvam : whisper(this.opts.whisperSize);
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) {
      const name = (e as { name?: string })?.name;
      return this.cb.onError(name === 'NotAllowedError' || name === 'SecurityError' ? 'noPermission' : 'failed');
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    const src = this.ctx.createMediaStreamSource(this.stream);
    const ds = new Downsampler(this.ctx.sampleRate);
    const onPcm = (raw: Float32Array) => this.onSamples(ds.push(raw));
    try {
      const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
      await this.ctx.audioWorklet.addModule(url);
      const n = new AudioWorkletNode(this.ctx, 'dy-capture');
      n.port.onmessage = (ev) => onPcm(ev.data as Float32Array);
      src.connect(n);
      this.node = n;
    } catch {
      // Older browsers: ScriptProcessor fallback
      const sp = this.ctx.createScriptProcessor(4096, 1, 1);
      sp.onaudioprocess = (ev) => onPcm(ev.inputBuffer.getChannelData(0).slice());
      src.connect(sp);
      sp.connect(this.ctx.destination);
      this.node = sp;
    }
    this.maxTimer = setTimeout(() => this.stop(), this.opts.maxMs ?? 120000);
    this.cb.onState('listening');
  }

  private startLive() {
    this.live = new WebSpeechLive();
    this.cb.onState('listening');
    this.live.start(this.opts.lang, (t) => this.cb.onPartial(t), (text, err) => {
      this.cb.onState('idle');
      if (err === 'not-allowed' || err === 'service-not-allowed') return this.cb.onError('noPermission');
      if (!text) return this.cb.onError(err === 'no-speech' || !err ? 'noSpeech' : 'failed');
      this.cb.onDone({ text, engine: 'webspeech', audio: null });
    });
  }

  private onSamples(s: Float32Array) {
    if (this.stopped || !s.length) return;
    this.chunks.push(s);
    this.total += s.length;
    const frames = this.vad.push(s);
    if (!this.settleChecked && this.vad.settled) {
      // re-check the first 1.5 s with the clip-level VAD: a short note said right at the tap counts
      this.settleChecked = true;
      if (hasSpeech(concat(this.chunks))) this.heardSpeech = true;
    }
    for (const f of frames) {
      // only trust decisions once the noise floor has settled, so shop noise at the tap
      // cannot start the auto-stop countdown before the owner has said anything
      if (f.speech && this.vad.settled) {
        this.heardSpeech = true;
        this.silenceMs = 0;
      } else this.silenceMs += 30;
      this.cb.onLevel(Math.min(1, f.level * 12));
    }
    // auto-stop after silence (only once speech was heard); give up after 8 s of nothing
    if (this.heardSpeech && this.silenceMs >= this.opts.autoStopMs) return void this.stop();
    if (!this.heardSpeech && this.total > 8 * SR) return void this.stop();
    // segment on a natural pause so partial text appears while the owner keeps talking
    const pending = this.total - this.committed;
    if ((pending > 6 * SR && this.silenceMs >= 600) || pending > 26 * SR) this.commitSegment();
  }

  private commitSegment() {
    const all = concat(this.chunks);
    this.chunks = [all];
    const seg = all.slice(this.committed, this.total);
    this.committed = this.total;
    const idx = this.segTexts.length;
    this.segTexts.push('');
    this.chain = this.chain.then(async () => {
      const text = await this.transcribeWithFallback(seg);
      this.segTexts[idx] = text;
      this.cb.onPartial(this.segTexts.filter(Boolean).join(' '));
    });
  }

  /** Sarvam auto-detects for real. Transformers.js Whisper silently falls back to ENGLISH when no
   *  language is given, so for Whisper "auto" means the owner's UI language (code-mixed English still works). */
  private langFor(engine: EngineId): Lang | 'auto' {
    return engine === 'whisper' && this.opts.lang === 'auto' ? this.opts.uiLang : this.opts.lang;
  }

  private async transcribeWithFallback(seg: Float32Array): Promise<string> {
    if (!this.engine) return '';
    try {
      return (await this.engine.transcribe(seg, this.langFor(this.engineId))).text;
    } catch (e) {
      if (this.engineId === 'sarvam') {
        // 402 (credits over), 429, timeout or anything else: switch to the offline pack for the session
        const w = whisper(this.opts.whisperSize);
        if (await w.isAvailable()) {
          this.cb.onFallback?.('sarvam', 'whisper');
          this.engine = w;
          this.engineId = 'whisper';
          return (await w.transcribe(seg, this.langFor('whisper'))).text;
        }
        this.cb.onFallback?.('sarvam', 'typing');
      }
      if (e instanceof SttError) return '';
      throw e;
    }
  }

  async stop(): Promise<void> {
    if (this.live) return this.live.stop();
    if (this.stopped) return;
    this.stopped = true;
    if (this.maxTimer) clearTimeout(this.maxTimer);
    this.cb.onState('thinking');
    this.cb.onLevel(0);
    try {
      this.node?.disconnect();
      this.stream?.getTracks().forEach((t) => t.stop());
      await this.ctx?.close();
    } catch {
      /* ignore */
    }
    if (!this.heardSpeech && !hasSpeech(concat(this.chunks))) {
      this.cb.onState('idle');
      return this.cb.onError('noSpeech');
    }
    if (this.total > this.committed) this.commitSegment();
    try {
      await this.chain;
    } catch {
      this.cb.onState('idle');
      return this.cb.onError('failed');
    }
    const audio = encodeWav(concat(this.chunks));
    const text = this.segTexts.filter(Boolean).join(' ').trim();
    this.cb.onState('idle');
    if (!text) return this.cb.onError('noSpeech');
    this.cb.onDone({ text, engine: this.engineId, audio });
  }

  cancel() {
    this.stopped = true;
    this.live?.abort();
    try {
      this.node?.disconnect();
      this.stream?.getTracks().forEach((t) => t.stop());
      void this.ctx?.close();
    } catch {
      /* ignore */
    }
    this.cb.onState('idle');
  }
}

/** Offline pack download with progress (asks the worker to fetch + cache the model). */
export async function downloadPack(size: WhisperSize, onProgress: (pct: number) => void): Promise<void> {
  try {
    await (navigator.storage as StorageManager | undefined)?.persist?.();
  } catch {
    /* optional */
  }
  await whisperWorker.load(WHISPER_MODELS[size].id, onProgress);
}
