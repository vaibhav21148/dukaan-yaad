// Audio helpers: streaming downsampler to 16 kHz mono, WAV encoding.
export const SR = 16000;

/** Streaming downsampler with a simple box low-pass. Works for any input rate >= 16 kHz. */
export class Downsampler {
  private ratio: number;
  private pos = 0; // fractional read position into the carried buffer
  private carry = new Float32Array(0);
  constructor(inRate: number) {
    this.ratio = inRate / SR;
  }
  push(input: Float32Array): Float32Array {
    if (this.ratio === 1) return input.slice();
    const buf = new Float32Array(this.carry.length + input.length);
    buf.set(this.carry);
    buf.set(input, this.carry.length);
    const out: number[] = [];
    const win = Math.max(1, Math.floor(this.ratio));
    while (this.pos + win < buf.length) {
      const start = Math.floor(this.pos);
      let s = 0;
      for (let k = 0; k < win; k++) s += buf[start + k];
      out.push(s / win);
      this.pos += this.ratio;
    }
    const keepFrom = Math.floor(this.pos);
    this.carry = buf.slice(keepFrom);
    this.pos -= keepFrom;
    return Float32Array.from(out);
  }
}

export function concat(chunks: Float32Array[]): Float32Array {
  const n = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Float32Array(n);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

export function encodeWav(samples: Float32Array, rate = SR): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

/** Decode any browser-supported audio blob to 16 kHz mono (used for re-transcription and evals in the browser). */
export async function decodeTo16k(blob: Blob): Promise<Float32Array> {
  const ctx = new OfflineAudioContext(1, 1, SR);
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * SR), SR);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const r = await off.startRendering();
  return r.getChannelData(0).slice();
}
