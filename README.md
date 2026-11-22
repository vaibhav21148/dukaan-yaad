# Dukaan Yaad

**Talk for 60 seconds at closing time; the app remembers everything.**

A voice-first memory for kirana owners. Say the day's account in Hinglish, Hindi, Marathi, Gujarati or English: supplier dues, items that ran out, customer udhaar, promised orders. The app turns the note into cards, you check them, and it keeps the khata. Tomorrow's work (who to pay, what to reorder, which orders are due) sits under the mic.

- **The mic is the app.** One big button. Tap to talk (or hold), it stops by itself after you go quiet.
- **Nothing is saved without you.** Every entry is an editable card. Doubts are yellow with one short question. Two "Sharma"s? It asks which one.
- **It never invents.** Any amount, name, item or date not in what you said is removed, both for the AI and the offline parser, and enforced in code (`shared/guard.ts`).
- **Works offline.** After the first load everything works without internet: typing or the offline speech pack, understanding, saving, khata and Poochho.
- **No login, no key needed.** Data stays on the phone (IndexedDB). "Example se try karo" shows the whole flow in 10 seconds with zero API calls.

## Run locally

```bash
npm install
npm run dev            # http://localhost:5173  (UI only; /api is not served by Vite)
vercel dev             # UI + /api functions, reads .env.local
```

Without any keys the app runs fully offline: offline parser, local answers, Web Speech or typing. Add keys to unlock online understanding and Sarvam speech-to-text.

## Environment variables (all free tiers)

Copy `.env.example` to `.env.local` (local) or add them in Vercel > Project > Settings > Environment Variables.

| Variable | Where to get it | Used for |
|---|---|---|
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) > Get API key (free, no card) | Note extraction + Ask (default provider) |
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com/keys) > API Keys (free; returns 429 over the limit, never charges) | Fallback provider |
| `SARVAM_API_KEY` | [dashboard.sarvam.ai](https://dashboard.sarvam.ai) > API keys (free signup credits, then pay-per-use; returns 402 when credits run out) | Online speech-to-text |
| `GEMINI_MODEL`, `GROQ_MODEL`, `SARVAM_MODEL`, `SARVAM_MODE` | optional overrides | defaults: `gemini-3.1-flash-lite`, `openai/gpt-oss-20b`, `saaras:v3`, `codemix` |
| `LLM_PROVIDER` | optional | `gemini` (default), `groq`, `anthropic` |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | optional, off by default | only used if set and `LLM_PROVIDER=anthropic` |

Free-tier data may be used by the provider to improve their products, so only send demo/test data through it.

## Deploy (Vercel Hobby, free)

```bash
npm i -g vercel
vercel login
vercel --prod          # framework: Vite, build: npm run build, output: dist (see vercel.json)
```

Then add the env vars above and redeploy. Check `https://<your-app>/api/health`: it shows which services are configured (never the keys).

## Tests and evals

```bash
npm test               # Vitest: parser, numbers, dates, party matching, guard, ledger math, undo, Ask, VAD, STT guards
npm run test:e2e       # Playwright on a Pixel 5 viewport: example note -> review -> save -> Kal ka kaam -> Poochho -> undo
npm run eval           # extraction + Ask + STT evals -> evals/report.md (timestamp + git hash), copy in evals/reports/
npm run eval:extraction -- --provider gemini --delay 4000   # one provider, gentle on free quotas, cached per case+provider+prompt version
npm run eval:stt -- --engines tiny,base,small,sarvam
```

Eval cases: `evals/cases/extraction.jsonl` and `evals/cases/ask.jsonl` contain only **5 example cases each**, clearly marked `"example": true`. Real cases and recordings go in the same files and `evals/audio/`.

## How it is built

React + TypeScript + Vite, plain CSS (the prototype's bahi-khata look; light and dark), `vite-plugin-pwa` (installable, offline shell), Dexie (IndexedDB, versioned schema), i18next (4 language files, no hardcoded UI strings), Vercel functions as thin proxies with per-IP rate limits. Details: [docs/PLAN.md](docs/PLAN.md) · prompts: [docs/PROMPTS.md](docs/PROMPTS.md) · speech: [docs/STT.md](docs/STT.md).

## Known limits

- Marathi and Gujarati UI text are draft translations; they need a native-speaker review.
- The offline parser is rule-based: it handles common phrasings, corrections, number words and multi-item sentences, but unusual phrasing produces a yellow "Samajh nahi aaya" card rather than a guess. The online path is better at free-form speech.
- The recommended offline speech pack is ~260 MB (`whisper-small`); smaller packs are weak on Hindi. Phone speed is not yet measured on a real device.
- The rate limit is per warm serverless instance, not global.
- Data lives in one browser on one phone; clearing site data deletes it. There is no sync or backup (out of scope).
- iOS Safari: Web Speech and install prompts behave differently; the app still works with typing or the offline pack.
