# Build brief for Claude Code: Dukaan Yaad (voice-first shop memory app)

You are building a production-quality version of **Dukaan Yaad** from scratch, using the attached `Dukaan_Yaad.html` as the working prototype and source of truth for behaviour, copy and visual style. Read that file fully before writing any code.

Work in the phases below. **Stop at the end of each phase**, post a short summary in this channel (what was built, what was tested, what is blocked, what needs my decision), and wait for my "go" before starting the next phase. Do not skip ahead.

---

## 1. Context (read this first)

**The assignment.** This is a product case study for Gro. They asked for a real problem seen up close, with an app that solves it. Reviewers outside my account must be able to open a public link and use the app. They will also look at the prompts used to build it and the evals used to test it.

**The problem.** A small kirana / shop owner runs the business from memory, a notebook and WhatsApp. Supplier dues, items that ran out, customer udhaar and promised orders slip through, and each slip costs money or a sale. Free ledger apps (Khatabook, OkCredit) exist but focus on customer credit and need typing into forms, one transaction at a time.

**The one bet.** "Talk for 60 seconds at closing time; the app remembers everything." Speaking once beats typing all day. The headline value is the **supplier and stock side**. Customer credit is captured from the same voice note but is not the headline.

**Users.** Owner-operator, 30 to 60 years old, mid-range Android phone, patchy mobile data, comfortable with WhatsApp voice notes, not comfortable with forms. Speaks Hinglish, Hindi, Marathi or Gujarati, often mixed with English words.

---

## 2. Non-negotiable product principles

1. **The mic is the app.** Home screen = one large mic button in the centre of the screen. Everything else is secondary and small. Every core action (adding entries, asking a question) must be doable by voice.
2. **Nothing is saved without confirmation.** Every extracted entry appears as an editable card. The owner taps "Sab sahi hai, save karo" to save.
3. **Never invent data.** No amount, name, item or date may appear in an entry unless it was spoken. If unclear, the card is marked yellow with one short question. This rule applies to the AI path and the offline parser.
4. **Works offline.** Recording, transcription, extraction, review, saving, the khata and Ask must all work with no internet after the first load and the offline pack download. Online services only improve quality; they are never required.
5. **Minimal and fast.** Large touch targets (min 48px), high contrast, works on a 5-year-old Android in Chrome, first load under 3 seconds on 4G excluding the optional offline speech model.
6. **Reviewer access.** Public URL, no login, no API key needed by the user. A "Try with example" button loads sample data so a reviewer sees value in 10 seconds.

---

## 3. Scope

### In scope (build all of these)

| Area | What it does |
|---|---|
| Voice input | Tap to start, tap to stop (also support press-and-hold). Live partial transcript. Typing fallback behind a small keyboard icon. |
| Languages | UI and speech in **4 languages**: Hindi/Hinglish (default), English, Marathi, Gujarati. Language picker on first launch and in settings. Speech in any of them, mixed with English, must work. |
| Offline speech-to-text | On-device STT engine, downloadable as an "offline pack" per language, cached for offline use. See section 5. |
| Extraction | Turn a note into typed entries: `supplier_due`, `supplier_paid`, `credit_given`, `credit_received`, `reorder`, `pending_order`. |
| Review cards | Edit type, name, amount, date, item. Delete. Yellow "shak" question when unclear. Show the exact quote each entry came from. |
| Corrections in speech | "Nahi, 300 tha" uses the corrected value. |
| Party matching | "Sharma ji", "Sharma uncle" map to one party; ask when two parties could match. Parties have aliases. |
| Relative dates | aaj, kal, parso, weekday names in all 4 languages, "Friday tak", resolved to dates. |
| Supplier dues | Who to pay, how much, by when. Overdue shown in red. |
| Reorder list | Items "khatam"/low, grouped by supplier when known. "Mangwa liya" marks done. |
| Customer credit | Running balance per customer, add and settle ("Mil gaya"). |
| Pending orders | Customer orders promised for later, with date. "Ho gaya" marks done. |
| Kal ka kaam | Under the mic: payments due by tomorrow, items to reorder, orders due. Two totals: customers owe me / I owe suppliers. |
| Khata | Tabs: Suppliers, Customers, Reorder, Orders. |
| Ask (Poochho) | Ask by voice or text, e.g. "Sharma ji ka kitna baaki hai?". Answers **only** from saved data. Optional: read the answer aloud with the browser's speech synthesis. |
| Note history | Last notes with timestamp and entry count; tap to see entries created from it. |
| Undo | 10-second undo after save and after any one-tap action (Paid, Mil gaya, etc.). |
| Demo mode | "Example se try karo" loads a sample note and sample ledger; "Demo data hatao" clears it. |
| Install | Installable PWA with icon, works from home screen, offline shell. |
| Prompt log | `docs/PROMPTS.md`: every prompt the app sends to an AI model, plus the major prompts I gave you to build it. |
| Evals | Eval harness and report (section 8). |

### Out of scope (do not build)

Billing, invoices and GST. Payments, UPI or collecting money. Sending reminders or messages to customers or suppliers. Inventory counting or barcode scanning. Multiple users, staff or family logins. Auto-ordering from distributors. Reports, analytics and profit. Cloud sync across devices and accounts. If you think one of these is needed, ask me; do not add it.

---

## 4. Tech stack (use this unless you hit a hard blocker, then ask)

- **App:** React + TypeScript + Vite. Plain CSS (CSS variables) carried over from the prototype's look: bahi-khata red cover, ruled page, ink-blue figures, marigold for doubts, Hind + Mukta fonts (self-host the fonts so they work offline). Light and dark mode.
- **PWA:** `vite-plugin-pwa` (Workbox). Precache the app shell; runtime-cache fonts; model files cached in Cache Storage / IndexedDB via the STT library.
- **Storage:** IndexedDB via Dexie. All data stays on the device. Schema versioned with migrations.
- **i18n:** `i18next` + `react-i18next`, one JSON file per language in `src/i18n/` (`hi.json`, `en.json`, `mr.json`, `gu.json`). No hardcoded UI strings in components. Hindi UI copy in Hinglish (Roman script) as in the prototype; Marathi and Gujarati in their native scripts with a toggle for Roman script if simple.
- **Server (thin):** Vercel serverless functions in `/api`. They only proxy to external APIs so keys never reach the browser. Rate limit per IP (e.g. 30 requests / 10 min) and cap request size (audio max 2 minutes / 5 MB).
  - `POST /api/transcribe`: audio in, transcript out (online STT, section 5).
  - `POST /api/extract`: transcript + known party names + today's date in, strict JSON entries out (LLM layer, section 4a).
  - `POST /api/ask`: question + ledger snapshot in, short answer out (LLM layer).
- **Hosting:** Vercel free (Hobby) plan, public URL. Provide `.env.example` with the variables in section 4a.

### 4a. Free-tier API keys only (no paid keys)

This project must run entirely on free tiers. I do **not** have an Anthropic key.

| Purpose | Provider (default first) | Env var | Free-tier notes |
|---|---|---|---|
| Note extraction + Ask | **Google Gemini API** (Flash or Flash-Lite model) | `GEMINI_API_KEY` | Free tier from Google AI Studio, no card. Per-project RPM/RPD limits; daily quota resets at midnight Pacific. Free-tier data may be used by Google to improve products, so only demo/test data goes through it. |
| Extraction fallback | **Groq** (an open model such as Llama) | `GROQ_API_KEY` | Free tier; over the limit it returns 429, never a charge. |
| Online speech-to-text | **Sarvam Speech-to-Text (Saaras)** | `SARVAM_API_KEY` | Free signup credits (treat as about ₹100), then pay-per-use. When credits run out the API returns 402. |
| Optional, off by default | Anthropic Claude | `ANTHROPIC_API_KEY` | Only used if the key is set and `LLM_PROVIDER=anthropic`. |

Build a **provider-agnostic LLM layer** in `api/_lib/llm.ts`:

```ts
generateJson<T>(prompt: string, schema: ZodSchema<T>): Promise<T>
generateText(prompt: string): Promise<string>
```

- Provider chosen by env var `LLM_PROVIDER` (`gemini` default). On 429, 402, timeout (8 s) or invalid JSON, try the next provider in the chain `gemini → groq → (anthropic if configured)`. If all fail, return a `fallback: true` flag so the client runs the offline parser.
- Use each provider's native JSON / structured-output mode. Check the current model IDs and request formats in each provider's docs (Google AI Studio, Groq console, Sarvam docs) before coding. Do not hardcode model names from memory; put them in env vars with sensible defaults (`GEMINI_MODEL`, `GROQ_MODEL`).
- Log which provider answered each request (server log + a small `by` field in the response) so the evals can report quality per provider.
- Keep Zod validation and the "never invent" post-check exactly as specified in section 6. Free models invent values more often, so this guard is mandatory.
- **Quota protection:** cache identical transcripts for 24 h on the client (hash → result) so retries and demo clicks don't burn quota. The "Example se try karo" demo uses a pre-computed result and makes **zero** API calls.
- **Graceful degradation is the product, not an edge case:** if every key is missing or exhausted, the app must still work end to end with on-device Whisper + the offline parser + local Ask. Show a small "Offline mode" chip, never an error screen.
- **Testing:** Vitest for units (parser, date resolution, ledger math, party matching), Playwright for one end-to-end flow on a mobile viewport.

---

## 5. Speech-to-text design (the core of the app)

Build an `SttEngine` interface so engines are swappable:

```ts
interface SttEngine {
  id: string;
  isAvailable(): Promise<boolean>;
  supports(lang: 'hi' | 'en' | 'mr' | 'gu'): boolean;
  transcribe(audio: Float32Array /* 16 kHz mono */, lang: string): Promise<{ text: string; confidence?: number }>;
  // optional streaming partials
  onPartial?(cb: (text: string) => void): void;
}
```

Engines, in order of preference (all free):

1. **Online: Sarvam Speech-to-Text (Saaras)** via `/api/transcribe`, using the free signup credits. Built for Indian languages and code-mixed speech. Use the code-mixed output mode so English words like "payment", "order", "Friday" stay in English, which helps extraction. Confirm current model name, endpoint, modes and audio format from Sarvam's docs before coding; do not guess. Billing is per second of audio, so trim leading/trailing silence before upload (see VAD below).
2. **Offline: Whisper in the browser via Transformers.js** (`@huggingface/transformers`). Free, no key, runs fully on the phone after the model is downloaded once.
   - Run in a dedicated Web Worker so the UI never freezes.
   - Let Transformers.js pick the device (WebGPU when available, WASM otherwise); do not hardcode `device: 'webgpu'`.
   - Use **multilingual** checkpoints (never the `.en` ones) from the `onnx-community` / `Xenova` Whisper ONNX repos, quantized. Benchmark `whisper-tiny`, `whisper-base` and `whisper-small`; default to the smallest one that is acceptable on our Hindi/Hinglish clips. Expect `tiny` to be weak on Hinglish.
   - Input must be 16 kHz mono Float32Array. Pass `language` ('hindi' / 'marathi' / 'gujarati' / 'english') and `task: 'transcribe'` from the selected language, but allow an "auto-detect" setting for mixed speakers.
   - Whisper sometimes hallucinates text on silence or noise (e.g. repeated phrases, "Thank you for watching"). Guard against it: run VAD first, drop segments with no speech, strip repeated n-grams, and discard outputs that are mostly non-speech. Add eval cases for silence and noise.
   - Hindi Whisper output is in Devanagari; transliterate to Roman Hinglish where the UI language is Hinglish, or make the offline parser accept both scripts (preferred: accept both).
3. **Alternative offline candidate to benchmark:** `vosk-browser` with `vosk-model-small-hi` (Hindi only, about 45 MB, streaming partials, Apache 2.0). Include it in the benchmark; only ship it if it beats Whisper on our Hindi clips.
4. **Last resort:** the browser Web Speech API where present (free, online on most Android Chrome builds), then typing.

**Voice activity detection (VAD):** use a small in-browser VAD (e.g. `@ricky0123/vad-web`, Silero-based, verify current package) to: auto-stop recording after about 2 s of silence (configurable), trim silence before sending audio online (saves Sarvam credits), and split long notes into chunks under 30 s for Whisper. Show a simple live level meter on the mic so the owner can see it is hearing him.

Rules:
- Record with `MediaRecorder` / `AudioWorklet`, resample to 16 kHz mono Float32 for local engines. Keep the raw audio blob with the note until it is saved (so it can be re-transcribed online later if the owner wants).
- Auto-choose: Sarvam when online, credits remain and it responds within 8 s; on 402 (credits exhausted), 429 or any error, switch to on-device Whisper for the rest of the session without asking. If no offline pack is downloaded yet, use Web Speech API, else typing. Show a small, plain status chip: "Online" / "Offline pack" / "Likh kar".
- For Gro reviewers (fresh browser, no pack): online Sarvam is the default path; offer the offline pack download only from settings so a reviewer is never forced into a big download.
- **Offline pack download:** settings screen lists each language with size and a Download button. Never download a large model silently on mobile data; ask first and show progress. Cache persistently (`navigator.storage.persist()`).
- Language hint: pass the selected language to the engine, but do not force it so Hinglish and mixed speech still work.
- Numbers: normalise spoken numbers in all 4 languages to digits before extraction ("paanch sau", "pachas hazaar", "teen sau pachas", Devanagari and Gujarati digits, "dedh hazaar", "dhai sau"). Unit test this.

---

## 6. Extraction design

Same output schema for both paths:

```json
{"entries":[{"type":"supplier_due","party":"Ramesh distributor","amount":5000,"item":null,"due":"2026-11-27","unclear":null,"quote":"Ramesh distributor ko 5000 dena hai Friday tak"}]}
```

- **Online path:** `/api/extract` calls the LLM layer (Gemini by default, Groq fallback; section 4a) with the prompt from the prototype's `aiPrompt()` as the starting point, extended for all 4 languages. Use the provider's structured output / JSON schema mode so the response is always valid. Validate on the server with Zod; drop anything not matching the schema. Post-check: any `amount` whose digits do not appear in the normalised transcript is nulled and gets an `unclear` question. Same check for dates and names where feasible. This guard is the "never invent" rule enforced in code, not just in the prompt.
- **Offline path:** rule-based parser in `src/extract/offline/`. Port `heuristic()` and `dateIn()` from the prototype, then extend with keyword tables per language (e.g. khatam / ख़त्म / संपले / ખતમ, udhaar / उधार / ઉધાર, dena / देणे / આપવાના), number normalisation, correction handling ("nahi, 300 tha"), and multi-item splitting. Keyword tables live in data files, not in code branches.
- **Upgrade when back online:** if a note was parsed offline and is still in review (not yet saved), offer "Online se dobara samjho". Never change entries that are already saved.
- **Party matching:** normalise names (strip ji, bhai, uncle, seth, sahab, distributor, wale, plus their Marathi/Gujarati equivalents), then fuzzy match against existing parties. One clear match: link it. Two or more close matches: mark the card unclear with "Kaun se Sharma? Sharma ji ya Sharma uncle?" and give one-tap choices.

---

## 7. Screens and UX

Keep it to these:

1. **Home (Aaj):** red cover band with the two totals. Big mic centred (at least 96px, pulsing while recording, plain-text state underneath: "Dabao aur bolo" / "Sun raha hoon..." / "Samajh raha hoon..."). Live transcript under the mic. Small keyboard icon for typing. Below: "Kal ka kaam" cards.
2. **Review:** cards from the latest note, as in the prototype, with the source quote and yellow doubt line. Big "Sab sahi hai, save karo" button. "Rehne do" to discard. Mic button here too: "Aur bolo" appends to the same note.
3. **Khata:** four tabs, simple lists, one-tap actions, tap a party to see its entry history.
4. **Poochho:** mic-first question input, answer card, optional read-aloud.
5. **Settings (small gear icon):** language, offline packs, demo data on/off, wipe data (two-step confirm, no browser `confirm()` dialogs), about/privacy line ("Aapka data sirf is phone mein hai").

Bottom bar: Aaj / Khata / Poochho. Accessibility: labels on all icon buttons, `aria-live` for status, respects reduced motion, works with screen zoom at 200%.

---

## 8. Evals (Gro deliverable 3)

Build the harness; **I will write the real test cases myself** (the brief wants them independent of the build). You create the structure and 5 example cases only, clearly marked as examples.

```
evals/
  cases/extraction.jsonl     # {id, lang, transcript, expected: [entries], must_ask: bool, notes}
  cases/ask.jsonl            # {id, ledger_fixture, question, expected_answer_facts}
  audio/                     # my recorded clips: <id>.webm + <id>.txt reference transcript
  run-extraction.ts          # runs online AND offline extractors on every case
  run-ask.ts
  run-stt.ts                 # WER/CER per engine per language on evals/audio
  report.md                  # generated
```

Metrics (report each per language and per path, online vs offline):

| Metric | Target |
|---|---|
| Invented values (amount, name or date not in the note) | 0 |
| Correct entry type and amount | 90%+ |
| Correct party (no wrong-person credit) | 95%+ |
| Asks when unclear (on cases with `must_ask: true`) | 100% |
| Ask answers match saved data | 100% |
| STT word error rate per engine per language | report only, used to pick defaults |

Case categories the harness should tag and break down by: corrections, similar names, relative dates, several entries in one sentence, settling credit, noise or half sentences, each language.

`npm run eval` runs everything and writes `evals/report.md` with a timestamp and git commit hash, so I can show a before/after.

---

## 9. Build phases (stop after each one)

**Phase 0: Plan.** Read the prototype. Reply with: folder structure, data model (Entry, Party, Note, Settings with types), the list of open questions, and anything in this brief you disagree with. No code yet.

**Phase 1: Skeleton and offline shell.** Vite + React + TS + PWA + Dexie + i18n with all 4 language files (copy from the prototype for Hinglish; draft Marathi/Gujarati and flag them for my review). Screens with the prototype's styling, typing input, the ported offline parser, review cards, khata, Kal ka kaam, Poochho (local answers), undo, demo mode. Unit tests for parser, dates, ledger math. Deploy a preview to Vercel and send me the URL.

**Phase 2: Online AI (free tiers).** Provider-agnostic LLM layer with Gemini default and Groq fallback (section 4a), `/api/extract` and `/api/ask`, schema validation, the "never invent" post-check, rate limiting, client-side result cache, graceful fallback to the offline parser on any error, quota or timeout. Before starting, tell me exactly which keys to create and where (Google AI Studio, Groq console) and I will add them to Vercel. Write `docs/PROMPTS.md`.

**Phase 3: Speech.** Recorder, VAD (auto-stop, silence trim, chunking), `SttEngine` interface, Sarvam online engine with 402/429 fallback, Whisper offline engine in a worker with the hallucination guards, Vosk candidate, offline pack download UI, number normalisation in 4 languages. Before starting, tell me how to create the Sarvam key. Run `run-stt.ts` on whatever clips are in `evals/audio` and recommend the default Whisper size with numbers (accuracy, model size in MB, seconds to transcribe a 30 s clip on a mid-range phone).

**Phase 4: Evals.** Harness, example cases, report generation. Then wait: I will add the real cases and recordings.

**Phase 5: Fix and polish.** Run evals, fix the worst failure type, rerun, keep both reports. Accessibility pass, Lighthouse PWA and performance check on a mobile profile, Playwright end-to-end test (example note to saved entries to Kal ka kaam to Poochho answer), offline test (airplane mode after offline pack download).

**Phase 6: Ship.** Production deploy, open the URL in a fresh incognito window and on a phone with no prior data, confirm a reviewer can use the full flow without signing in. Write `README.md`: what it is, how to run locally, env vars, how to run evals, known limits.

---

## 10. Working rules

- Ask before adding any dependency over 200 KB gzipped to the main bundle (STT models are loaded on demand and are fine).
- Never put API keys in client code or commit `.env`.
- Free tiers only. Do not add any service that needs a credit card or a paid plan without asking me first.
- Eval runs should go easy on free quotas: add a `--provider` flag and a delay between calls, and cache results per case + provider + prompt version.
- Commit after each meaningful step with clear messages. Small PR-sized commits.
- If something in the prototype conflicts with this brief, this brief wins; mention the conflict.
- If an external API's current docs differ from what this brief assumes, follow the docs and tell me.
- Keep user-facing copy short, warm and plain. No jargon on screen.
- Do not write my 1-page Gro write-up. That has to be in my own words.

Start with Phase 0.
