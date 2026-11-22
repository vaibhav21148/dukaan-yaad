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

/**
 * Streaming VAD. Noise floor = quietest frame in the last ~1.5 s ("minimum statistics"), so it works
 * even when the owner starts talking the instant they tap (gaps between words reveal the floor),
 * and steady shop noise raises the floor instead of counting as speech.
 */
export class EnergyVad {
  private ring: number[] = [];
  private hang = 0;
  private pending = new Float32Array(0);
  speaking = false;
  /** true once 1.5 s of history exists; before that, decisions are provisional */
  get settled() {
    return this.ring.length >= 50;
  }
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
      this.ring.push(e);
      if (this.ring.length > 50) this.ring.shift();
      // until 1.5 s of history exists, assume a quiet room so a word spoken right at the tap is not lost
      const floor = Math.max(0.002, Math.min(...this.ring, this.ring.length < 50 ? 0.004 : Infinity));
      const thr = Math.max(this.minThreshold, floor * this.ratio);
      const isSpeech = e > thr;
      if (isSpeech) this.hang = this.hangFrames;
      else this.hang = Math.max(0, this.hang - 1);
      this.speaking = isSpeech || this.hang > 0;
      out.push({ speech: this.speaking, level: e });
    }
    this.pending = buf.slice(off);
    return out;
  }
}

/**
 * Per-frame speech flags for a whole clip. Non-causal: the floor is the quietest frame within
 * +-0.75 s, so speech at the very start is kept and steady noise is not mistaken for speech.
 */
export function speechFrames(a: Float32Array, minThreshold = 0.012, ratio = 2.6, hangFrames = 10): boolean[] {
  const n = Math.floor(a.length / FRAME);
  const e = Array.from({ length: n }, (_, i) => rms(a, i * FRAME, (i + 1) * FRAME));
  const out: boolean[] = [];
  let hang = 0;
  for (let i = 0; i < n; i++) {
    let floor = Infinity;
    for (let j = Math.max(0, i - 25); j < Math.min(n, i + 26); j++) floor = Math.min(floor, e[j]);
    const isSpeech = e[i] > Math.max(minThreshold, Math.max(0.002, floor) * ratio);
    hang = isSpeech ? hangFrames : Math.max(0, hang - 1);
    out.push(isSpeech || hang > 0);
  }
  return out;
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
