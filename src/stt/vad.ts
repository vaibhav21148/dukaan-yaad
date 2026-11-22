// Small energy-based voice activity detector (no model download, runs on any phone).
// Used to: auto-stop after silence, trim silence before upload, split long notes into <30 s chunks,
// and reject silence/noise so Whisper is never asked to "transcribe" nothing.
import { SR } from './audio';

export const FRAME = 480; // 30 ms at 16 kHz

export function rms(a: Float32Array, from = 0, to = a.length): number {
  let s = 0;
  for (let i = from; i < to; i++) s += a[i] * a[i];
  return Math.sqrt(s / Math.max(1, to - from));
}

/** Streaming VAD with an adaptive noise floor and a short hangover. */
export class EnergyVad {
  private floor = 0;
  private frames = 0;
  private hang = 0;
  private pending = new Float32Array(0);
  speaking = false;
  constructor(private minThreshold = 0.012, private ratio = 2.6, private hangFrames = 10) {}

  /** Feed 16 kHz samples; returns per-frame decisions. */
  push(samples: Float32Array): { speech: boolean; level: number }[] {
    const out: { speech: boolean; level: number }[] = [];
    const buf = new Float32Array(this.pending.length + samples.length);
    buf.set(this.pending);
    buf.set(samples, this.pending.length);
    let off = 0;
    for (; off + FRAME <= buf.length; off += FRAME) {
      const e = rms(buf, off, off + FRAME);
      this.frames++;
      if (this.frames <= 10) this.floor = this.frames === 1 ? e : Math.min(this.floor, e);
      const thr = Math.max(this.minThreshold, this.floor * this.ratio);
      const isSpeech = e > thr;
      if (isSpeech) this.hang = this.hangFrames;
      else {
        this.hang = Math.max(0, this.hang - 1);
        this.floor = this.floor * 0.97 + e * 0.03; // follow background noise slowly
      }
      this.speaking = isSpeech || this.hang > 0;
      out.push({ speech: this.speaking, level: e });
    }
    this.pending = buf.slice(off);
    return out;
  }
}

/** Per-frame speech flags for a whole clip (offline pass). */
export function speechFrames(a: Float32Array): boolean[] {
  const v = new EnergyVad();
  return v.push(a).map((f) => f.speech);
}

export function speechRatio(a: Float32Array): number {
  const f = speechFrames(a);
  return f.length ? f.filter(Boolean).length / f.length : 0;
}

export function hasSpeech(a: Float32Array, minMs = 300): boolean {
  return speechFrames(a).filter(Boolean).length * 30 >= minMs;
}

/** Cut leading/trailing silence, keeping a little padding. */
export function trimSilence(a: Float32Array, padMs = 250): Float32Array {
  const f = speechFrames(a);
  const first = f.indexOf(true);
  const last = f.lastIndexOf(true);
  if (first < 0) return new Float32Array(0);
  const pad = Math.round((padMs / 1000) * SR);
  return a.slice(Math.max(0, first * FRAME - pad), Math.min(a.length, (last + 1) * FRAME + pad));
}

/** Split into chunks under maxSec, cutting at the quietest point near the limit. */
export function splitChunks(a: Float32Array, maxSec = 28, minSec = 18): Float32Array[] {
  const max = maxSec * SR;
  if (a.length <= max) return [a];
  const out: Float32Array[] = [];
  let start = 0;
  while (a.length - start > max) {
    let best = start + max;
    let bestE = Infinity;
    for (let p = start + minSec * SR; p + FRAME < start + max; p += FRAME) {
      const e = rms(a, p, p + FRAME);
      if (e < bestE) {
        bestE = e;
        best = p;
      }
    }
    out.push(a.slice(start, best));
    start = best;
  }
  out.push(a.slice(start));
  return out;
}
