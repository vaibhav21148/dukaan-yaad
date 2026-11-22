# Plan, data model and decisions

This is the "Phase 0" write-up from the brief, plus what changed while building.

## Folder structure

```
api/                    Vercel functions (thin proxies; keys stay server-side)
  _lib/llm.ts           provider-agnostic LLM layer: generateJson / generateText, gemini -> groq -> (anthropic)
  _lib/http.ts          JSON helper, per-IP rate limit, body caps
  extract.ts ask.ts transcribe.ts health.ts
shared/                 code used by the phone, the server and the evals
  types.ts schema.ts    data model + Zod schemas + JSON schema for structured output
  prompts.ts            every AI prompt (see docs/PROMPTS.md)
  guard.ts              the "never invent" post-check
  numbers.ts dates.ts   spoken numbers and relative dates in 4 languages
  names.ts translit.ts  honorific stripping, cross-script fuzzy party matching
  messages.ts           doubt questions in 4 languages
src/
  extract/offline/      rule-based parser + keyword tables (data file)
  extract/index.ts      cache -> online -> offline, never fails
  domain/               ledger math, drafts (party matching), demo data
  db/                   Dexie schema (versioned), repo with undo for every write
  stt/                  recorder session, VAD, engines (Sarvam, Whisper worker, Web Speech), guards
  ask/                  local answerer + grounding check for AI answers
  screens/ components/  Home (Aaj), Review, Khata, Ask (Poochho), Settings
  i18n/                 hi.json (Hinglish), en.json, mr.json, gu.json
evals/                  cases, fixtures, audio, runners, report.md
tests/unit tests/e2e    Vitest + Playwright (mobile viewport)
```

## Data model (`shared/types.ts`)

| Type | Key fields |
|---|---|
| `Entry` | id, noteId, type (6 types), partyId, party (as spoken), amount, item, due (YYYY-MM-DD), quote, status open/done, createdAt, source note/button/demo, demo flag |
| `Party` | id, name, aliases[] (other spoken forms, learnt on save), demo flag |
| `Note` | id, text, createdAt, entryIds, by (gemini/groq/anthropic/offline/demo), stt engine, lang |
| `Settings` | lang, onboarded, sttLang (auto or a language), autoStopMs, readAloud, whisperModel, onlineAi, theme |
| `CurrentDraft` | the note on the review screen: text, DraftEntry[], raw audio blob (kept until saved), offlineParsed flag |
| `DraftEntry` | an extracted entry + partyId + `choices` / `choiceQuestion` when two parties could match |

Balances are always derived from entries (never stored), so undo is just "delete what was added / restore what was changed".

## Decisions taken without asking (the brief said to stop and ask; the owner asked for one go)

| Topic | Decision | Why |
|---|---|---|
| VAD | Own energy VAD (minimum-statistics noise floor), not `@ricky0123/vad-web` | Silero VAD pulls a second ONNX runtime + model into the main path; the energy VAD is tiny, works offline from first load, and is unit tested for silence, noise and speech-at-the-tap. Swap later if real clips show problems. |
| Offline pack per language | One Whisper pack covers all 4 languages | Whisper is multilingual: one model, not one per language. The settings screen lists sizes instead of languages and says so. |
| Default Whisper size | `small` (~260 MB), not `base` | On test clips `base` wrote Hindi in Urdu script and `tiny` drifted into English; only `small` gave usable Devanagari. See docs/STT.md. Must be re-checked with real recordings. |
| "Auto" speech language | Sarvam: true auto-detect. Whisper: UI language as the hint | Transformers.js silently assumes English when no language is passed. |
| Vosk | Not shipped, not benchmarked yet | `vosk-browser` only runs in a browser; the Node STT runner cannot measure it. Ship only if it beats Whisper on real Hindi clips. |
| Roman-script toggle for Marathi/Gujarati UI | Not built | Brief said "if simple"; it needs a second full copy of the copy deck. |
| Party match across sides | A near-name match that crosses ledger sides ("Gupta ji" customer vs "Gupta Traders" supplier) asks instead of linking | Found in testing: it credited the wrong person. |
| Unresolved "which person" | Save is blocked until the owner picks a person or "Naya naam" | "Ask when unclear" must not be skippable for wrong-person risk. |
| Navigation during review | Allowed; the draft is persisted and reappears on Aaj | The prototype blocked navigation; persisting is friendlier and loses nothing. |
| Rate limit | In-memory per warm function instance | Free and good enough against casual abuse; not a hard global limit. |

## Where the brief and current reality differ

- **Model IDs** (checked Nov 2026): Gemini default `gemini-3.1-flash-lite` with `responseJsonSchema`; Groq default `openai/gpt-oss-20b` with `json_schema`; Sarvam `saaras:v3` (also `v4`) with `mode=codemix`. All are env vars.
- **Sarvam REST limit is 30 s per request**, so audio is split into < 28 s chunks at quiet points before upload (this also serves the brief's chunking rule).
- **Vercel body limit is ~4.5 MB**, below the brief's 5 MB cap; 28 s chunks are ~0.9 MB so this never bites.

## Open questions for the owner

1. Marathi and Gujarati UI copy are drafts: please have a native speaker review `src/i18n/mr.json` and `gu.json`.
2. Is ~260 MB acceptable as the recommended offline pack on a shop owner's phone, or do we accept weaker Hindi with `base` and lean on Sarvam?
3. Real eval cases and recordings (the brief reserves these for you).
