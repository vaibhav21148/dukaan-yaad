// WER / CER per engine per language on evals/audio/<id>.(wav|webm|m4a|ogg) + <id>.txt.
// Engines: whisper-tiny / base / small (Transformers.js on Node, same ONNX models as the phone) and Sarvam (if SARVAM_API_KEY).
// Also reports model size and seconds to transcribe 30 s of audio on THIS machine (scale ~4-8x for a mid-range phone; see report note).
// Usage: npm run eval:stt -- --engines tiny,base,small,sarvam
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanTranscript } from '../src/stt/guards';
import { speechRatio, splitChunks, trimSilence } from '../src/stt/vad';
import { EVALS, errorRates } from './lib';

const dirArg = process.argv.indexOf('--dir');
const AUDIO = dirArg > 0 ? process.argv[dirArg + 1] : join(EVALS, 'audio');
const SR = 16000;
const LANGS: Record<string, string> = { hi: 'hindi', mr: 'marathi', gu: 'gujarati', en: 'english' };

function decode(file: string): Float32Array {
  if (file.endsWith('.wav')) {
    const b = readFileSync(file);
    // assume 16-bit PCM; resample naively if needed
    const rate = b.readUInt32LE(24);
    const ch = b.readUInt16LE(22);
    let off = 12;
    while (off < b.length && b.toString('ascii', off, off + 4) !== 'data') off += 8 + b.readUInt32LE(off + 4);
    const data = b.subarray(off + 8);
    const n = Math.floor(data.length / 2 / ch);
    const mono = new Float32Array(n);
    for (let i = 0; i < n; i++) mono[i] = data.readInt16LE(i * 2 * ch) / 32768;
    if (rate === SR) return mono;
    const out = new Float32Array(Math.floor((n * SR) / rate));
    for (let i = 0; i < out.length; i++) out[i] = mono[Math.floor((i * rate) / SR)];
    return out;
  }
  const raw = execFileSync('ffmpeg', ['-v', 'quiet', '-i', file, '-f', 'f32le', '-ac', '1', '-ar', String(SR), '-'], { maxBuffer: 1 << 28 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
}

function encodeWav(s: Float32Array): Buffer {
  const b = Buffer.alloc(44 + s.length * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + s.length * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(s.length * 2, 40);
  for (let i = 0; i < s.length; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(s[i] * 32767))), 44 + i * 2);
  return b;
}

export async function runStt(): Promise<{ md: string }> {
  const engArg = process.argv.indexOf('--engines');
  const engines = (engArg > 0 ? process.argv[engArg + 1] : 'tiny,base,small,sarvam').split(',');
  const clips = existsSync(AUDIO)
    ? readdirSync(AUDIO)
        .filter((f) => /\.(wav|webm|m4a|ogg|mp3)$/.test(f))
        .map((f) => ({ id: f.replace(/\.[^.]+$/, ''), file: join(AUDIO, f) }))
        .filter((c) => existsSync(join(AUDIO, c.id + '.txt')))
    : [];
  if (!clips.length) {
    return {
      md: '## Speech-to-text\n\n_No clips yet. Add `<id>.webm` + `<id>.txt` pairs to `evals/audio/` (see its README) and run `npm run eval:stt`. The default Whisper size stays `base` until measured._\n\nVosk (`vosk-browser`, Hindi only) is not benchmarked by this runner: it only runs in a browser. It should be shipped only if it beats Whisper on these clips.',
    };
  }
  const rows: { engine: string; lang: string; id: string; wer: number; cer: number; secs: number; dur: number; hyp: string }[] = [];
  const sizes: Record<string, string> = {};
  for (const engine of engines) {
    let transcribe: ((a: Float32Array, lang: string) => Promise<string>) | null = null;
    if (engine === 'sarvam') {
      const key = process.env.SARVAM_API_KEY;
      if (!key) continue;
      transcribe = async (a, lang) => {
        const parts: string[] = [];
        for (const ch of splitChunks(trimSilence(a), 28)) {
          const form = new FormData();
          form.append('file', new Blob([new Uint8Array(encodeWav(ch))], { type: 'audio/wav' }), 'a.wav');
          form.append('model', process.env.SARVAM_MODEL || 'saaras:v3');
          form.append('mode', process.env.SARVAM_MODE || 'codemix');
          form.append('language_code', `${lang}-IN`);
          const r = await fetch('https://api.sarvam.ai/speech-to-text', { method: 'POST', headers: { 'api-subscription-key': key }, body: form });
          if (!r.ok) throw new Error('sarvam ' + r.status);
          parts.push((await r.json()).transcript ?? '');
        }
        return parts.join(' ');
      };
    } else {
      const { pipeline } = await import('@huggingface/transformers');
      const model = `onnx-community/whisper-${engine}`;
      const asr = (await pipeline('automatic-speech-recognition', model, { dtype: 'q8' } as never)) as unknown as (a: Float32Array, o: object) => Promise<{ text: string }>;
      sizes[engine] = { tiny: '~45 MB', base: '~85 MB', small: '~260 MB' }[engine] ?? '?';
      transcribe = async (a, lang) => {
        const t = trimSilence(a);
        if (!t.length) return '';
        const out: string[] = [];
        for (const ch of splitChunks(t, 28)) out.push(cleanTranscript((await asr(ch, { language: LANGS[lang], task: 'transcribe', no_repeat_ngram_size: 4 })).text, speechRatio(ch)));
        return cleanTranscript(out.join(' '), speechRatio(a));
      };
    }
    for (const c of clips) {
      const lang = c.id.split(/[-_]/)[0];
      const audio = decode(c.file);
      const ref = readFileSync(join(AUDIO, c.id + '.txt'), 'utf8').trim();
      const t0 = Date.now();
      let hyp = '';
      try {
        hyp = await transcribe(audio, LANGS[lang] ? lang : 'hi');
      } catch (e) {
        hyp = `ERROR ${(e as Error).message}`;
      }
      const secs = (Date.now() - t0) / 1000;
      rows.push({ engine, lang, id: c.id, ...errorRates(ref, hyp), secs, dur: audio.length / SR, hyp });
    }
  }
  const groups = new Map<string, typeof rows>();
  for (const r of rows) groups.set(`${r.engine}|${r.lang}`, [...(groups.get(`${r.engine}|${r.lang}`) ?? []), r]);
  const avg = (l: number[]) => l.reduce((a, b) => a + b, 0) / Math.max(1, l.length);
  const md = [
    '## Speech-to-text',
    '| Engine | Lang | Clips | WER | CER | Model size | Sec per 30 s audio (this machine) |',
    '|---|---|---|---|---|---|---|',
    ...[...groups.entries()].map(([k, l]) => {
      const [engine, lang] = k.split('|');
      const per30 = (avg(l.map((r) => r.secs)) / Math.max(1, avg(l.map((r) => r.dur)))) * 30;
      return `| ${engine} | ${lang} | ${l.length} | ${(avg(l.map((r) => r.wer)) * 100).toFixed(1)}% | ${(avg(l.map((r) => r.cer)) * 100).toFixed(1)}% | ${sizes[engine] ?? 'online'} | ${per30.toFixed(1)} |`;
    }),
    '',
    '_Phone timing: a mid-range Android on WASM is typically several times slower than a laptop; measure on the target phone via the app before choosing `small`._',
    '',
    '<details><summary>Transcripts</summary>\n',
    ...rows.map((r) => `- \`${r.id}\` ${r.engine}: ${r.hyp}`),
    '\n</details>',
  ].join('\n');
  return { md };
}

if (import.meta.url === `file://${process.argv[1]}`) runStt().then(({ md }) => console.log(md));
