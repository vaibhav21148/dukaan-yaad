# Prompt log

Every prompt the app sends to an AI model, and the main prompts used to build the app.
Source of truth for the app prompts: [`shared/prompts.ts`](../shared/prompts.ts) (current version: `v1`). Bump `PROMPT_VERSION` when a prompt changes: it is part of every cache key (client 24 h cache and eval cache).

## 1. Prompts the app sends

### 1a. Note extraction: `POST /api/extract`

Sent to Gemini (default), then Groq, then Anthropic (only if configured), using each provider's JSON / structured-output mode with the schema `EXTRACT_JSON_SCHEMA` in [`shared/schema.ts`](../shared/schema.ts).
Started from the prototype's `aiPrompt()`, extended for Marathi and Gujarati, number words, quantities, and the which-person question.

After the model answers, the server (and the phone again) runs:
1. **Zod validation**: invalid entries are dropped, not the whole result.
2. **Never-invent guard** ([`shared/guard.ts`](../shared/guard.ts)): any amount whose digits are not in the normalised transcript, any name not spoken (any script), any item not spoken, any date when no date word was spoken is set to null, and the card gets a short question.

Example, rendered:

```text
You turn a small Indian shop owner's spoken note into ledger entries.
The note may be in Hinglish, Hindi, Marathi, Gujarati or English, often mixed, in Roman or native script. It may come from speech-to-text and contain small recognition errors.
Today is 2026-11-22 (sunday).
Names already in the ledger: Sharma ji, Ramesh distributor.
Return ONLY JSON: {"entries":[{"type":"...","party":null,"amount":null,"item":null,"due":null,"unclear":null,"quote":"..."}]}
Types:
- supplier_due: the shop owes a supplier or distributor money ("Ramesh ko 5000 dena hai", "रमेशला 5000 द्यायचे", "રમેશને 5000 આપવાના")
- supplier_paid: the shop paid a supplier ("Ramesh ko 2000 de diye")
- credit_given: a customer took goods on udhaar / owes the shop ("Sharma ji ka 200 udhaar", "शर्मा यांचे 200 उधार", "શર્માનું 200 ઉધાર")
- credit_received: a customer paid back udhaar ("Verma ji ne 150 de diye", "वर्मा यांनी 150 परत दिले")
- reorder: an item ran out or is low (khatam, ख़त्म, संपले, ખતમ). One entry per item, item filled, party = supplier only if one is named.
- pending_order: a customer's order to deliver later
Rules:
- Never invent an amount, name, item or date. Use null when it was not said. Do not calculate totals.
- Spoken numbers become digits: "paanch sau" = 500, "dedh hazaar" = 1500, "dhai sau" = 250, "पाच हजार" = 5000.
- Quantities like "2 kilo" belong in item, not amount.
- If the speaker corrects himself ("nahi, 300 tha", "नाही, 300"), use the corrected value and include both parts in quote.
- If something is ambiguous (which person, unclear amount, unclear type), still return the entry and set "unclear" to ONE short question in Hinglish (Roman script).
- Resolve relative dates (aaj, kal, parso, weekday names, "Friday tak", उद्या, परवा, કાલે) to YYYY-MM-DD from today. "kal" means tomorrow when something is due.
- Use an existing ledger name when it is clearly the same person ("Sharma uncle" = "Sharma ji"). If two existing names could match, keep the spoken name and ask which one in "unclear".
- Keep names as spoken (same script). amount is a number in rupees. "quote" is the exact words this entry came from.
Note:
"""Ramesh distributor ko 5000 dena hai Friday tak, Maggi khatam"""
```

### 1b. Ask: `POST /api/ask`

The phone sends only a ledger snapshot (balances, reorder list, open orders), never raw notes. The answer is then checked on the phone: every number in it must be a saved amount, a sum of saved amounts, or a count (`answerIsGrounded` in [`src/ask/index.ts`](../src/ask/index.ts)); otherwise the local answer is shown instead.

```text
You answer a small shop owner's question using ONLY the ledger data below.
If the data does not contain the answer, say so plainly. Never guess or calculate anything that is not a simple sum of the listed amounts.
Reply in Hinglish (Roman script), at most 3 short sentences, amounts as ₹ with Indian digit grouping.
Today is 2026-11-22.
Data: {"today":"2026-11-22","suppliers_owed":[{"name":"Ramesh distributor","amount":5000,"due":"2026-11-27"}],"customers_owe":[{"name":"Sharma ji","amount":650}],"to_reorder":[{"item":"Maggi","supplier":null}],"pending_orders":[]}
Question: Sharma ji ka kitna baaki hai?
Return JSON: {"answer":"..."}
```

### 1c. Speech-to-text

Not an LLM prompt. `POST /api/transcribe` sends WAV audio to Sarvam `/speech-to-text` with `model=saaras:v3` (env `SARVAM_MODEL`), `mode=codemix`, `language_code` = `hi-IN` / `mr-IN` / `gu-IN` / `en-IN` or `unknown` for auto. Whisper (offline) gets `language` + `task: "transcribe"`.

## 2. Prompts used to build the app

1. The owner's build brief, verbatim: [`docs/BUILD_BRIEF.md`](BUILD_BRIEF.md) (with the prototype [`docs/prototype.html`](prototype.html)).
2. The kickoff message to Claude Code:
   > I have uploaded a build prompt.md in the same folder. I would like you to read it, get a sense of it, plan how things will look and work, plan it and build it in one go.

   This overrode the brief's "stop after each phase" rule: all phases were built in one session. Decisions that the brief said to ask about are listed in [`docs/PLAN.md`](PLAN.md) under "Decisions taken without asking".
