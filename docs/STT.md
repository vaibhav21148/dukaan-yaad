# Speech-to-text: engines and first benchmark

## Engine order (src/stt/session.ts)

1. **Sarvam (online)**, when `/api/health` says a key is configured and the phone is online. On 402 (credits over), 429, timeout or any error, the session switches to Whisper for the rest of the session without asking.
2. **Whisper offline pack** (Transformers.js in a Web Worker; WebGPU if the browser has an adapter, WASM otherwise), when the pack is downloaded.
3. **Browser Web Speech API**, when present and online.
4. **Typing.**

The chip in the header shows which one is active: Online / Offline pack / Browser / Likh kar.

Guards: silence is trimmed before upload (saves Sarvam credits); audio is split into < 28 s chunks at the quietest point. Whisper output is cleaned of known hallucinations ("Thank you for watching", `[Music]`, lone "धन्यवाद"), runs of a phrase repeated 3+ times are collapsed, and output from clips that are mostly silence is dropped.

## First benchmark (synthetic clips, NOT real shop audio)

Run on 2026-11-22 with macOS text-to-speech voices (Hindi "Lekha", Indian English "Rishi"), plus 4 s of silence and 4 s of noise. Laptop (Apple Silicon, Node, WASM, q8).

| Model | Size | Hindi WER | Hindi CER | Sec per 30 s audio (laptop) | What it wrote for "रमेश डिस्ट्रीब्यूटर को पाँच हज़ार देना है शुक्रवार तक" |
|---|---|---|---|---|---|
| whisper-tiny | ~45 MB | 50% | 49% | 1.7 | `Ramesh district Newterco 5-10-10 days.` (drifts to English) |
| whisper-base | ~85 MB | 50% | 44% | 2.0 | `رمیش دیسریب دیوتر کو 5000 دینہ ہے شکرور تک` (Urdu script) |
| whisper-small | ~260 MB | **12%** | **7%** | 5.9 | `रमेश दिस्ट्रीट दिउतर को पाज रहाजार देना है शुक्रवार तक` |

Silence and noise clips produced empty output on all three (hallucination guards working).

**Recommendation:** default to `whisper-small` for the offline pack. `base` is not usable for Hindi because the parser cannot read Urdu script. Expect a mid-range phone on WASM to be several times slower than the laptop (rough guess 20-40 s per 30 s note); measure on a real phone before deciding whether `small` is acceptable offline. Sarvam remains the default path when online.

Bugs found by this benchmark and fixed:
- Transformers.js assumes English when no language is passed; "auto" now means the UI language for Whisper.
- The VAD missed speech that starts the instant the mic opens; it now uses a minimum-statistics noise floor plus a centred window for whole-clip checks.

Re-run with real recordings: put `<lang>-<n>.webm` + `.txt` in `evals/audio/`, then `npm run eval:stt -- --engines tiny,base,small,sarvam`.
