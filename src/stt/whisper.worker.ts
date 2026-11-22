/// <reference lib="webworker" />
// Whisper (multilingual, quantized) running fully on the phone via Transformers.js.
// Loaded only when the owner downloads the offline pack. The UI thread never blocks.
import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

type Asr = (audio: Float32Array, opts: Record<string, unknown>) => Promise<{ text: string } | { text: string }[]>;
let asr: Asr | null = null;
let current: string | null = null;

async function pickDevice(): Promise<'webgpu' | 'wasm'> {
  // Feature-detect instead of hard-coding: WebGPU when the browser really has an adapter, WASM otherwise.
  try {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    if (gpu && (await gpu.requestAdapter())) return 'webgpu';
  } catch {
    /* fall through */
  }
  return 'wasm';
}

async function load(model: string, onProgress: (p: number) => void) {
  if (asr && current === model) return;
  const device = await pickDevice();
  const files = new Map<string, { loaded: number; total: number }>();
  const progress_callback = (p: { status: string; file?: string; loaded?: number; total?: number }) => {
    if (p.status === 'progress' && p.file) {
      files.set(p.file, { loaded: p.loaded ?? 0, total: p.total ?? 0 });
      const t = [...files.values()].reduce((a, f) => ({ l: a.l + f.loaded, t: a.t + f.total }), { l: 0, t: 0 });
      if (t.t) onProgress(Math.round((t.l / t.t) * 100));
    }
  };
  const opts = {
    device,
    dtype: device === 'webgpu' ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8',
    progress_callback,
  };
  try {
    asr = (await pipeline('automatic-speech-recognition', model, opts as never)) as unknown as Asr;
  } catch (e) {
    if (device !== 'webgpu') throw e;
    asr = (await pipeline('automatic-speech-recognition', model, { ...opts, device: 'wasm', dtype: 'q8' } as never)) as unknown as Asr;
  }
  current = model;
}

self.onmessage = async (ev: MessageEvent) => {
  const { id, type } = ev.data;
  const post = (t: string, data?: unknown) => (self as unknown as Worker).postMessage({ id, type: t, data });
  try {
    if (type === 'load') {
      await load(ev.data.model, (p) => post('progress', p));
      post('done', true);
    } else if (type === 'transcribe') {
      if (!asr) throw new Error('model not loaded');
      const out = await asr(ev.data.audio, {
        language: ev.data.language ?? undefined, // null -> auto-detect for mixed speakers
        task: 'transcribe',
        chunk_length_s: 30,
        no_repeat_ngram_size: 4,
      });
      const text = Array.isArray(out) ? out.map((o) => o.text).join(' ') : out.text;
      post('done', text);
    }
  } catch (e) {
    post('error', e instanceof Error ? e.message : String(e));
  }
};
