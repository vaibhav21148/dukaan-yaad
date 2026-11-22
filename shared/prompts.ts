// Every prompt the app sends to an AI model lives here (mirrored in docs/PROMPTS.md).
// Bump PROMPT_VERSION when a prompt changes: it is part of every cache key.
import { WEEKDAY_EN, weekdayOf } from './dates.js';
import type { Lang, LedgerSnapshot } from './types.js';

export const PROMPT_VERSION = 'v1';

const LANG_NAME: Record<Lang, string> = { hi: 'Hinglish (Roman script)', en: 'simple English', mr: 'Marathi (Devanagari)', gu: 'Gujarati (Gujarati script)' };

export function extractPrompt(transcript: string, parties: string[], today: string, lang: Lang): string {
  return `You turn a small Indian shop owner's spoken note into ledger entries.
The note may be in Hinglish, Hindi, Marathi, Gujarati or English, often mixed, in Roman or native script. It may come from speech-to-text and contain small recognition errors.
Today is ${today} (${WEEKDAY_EN[weekdayOf(today)]}).
Names already in the ledger: ${parties.length ? parties.slice(0, 80).join(', ') : 'none yet'}.
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
- If something is ambiguous (which person, unclear amount, unclear type), still return the entry and set "unclear" to ONE short question in ${LANG_NAME[lang]}.
- Resolve relative dates (aaj, kal, parso, weekday names, "Friday tak", उद्या, परवा, કાલે) to YYYY-MM-DD from today. "kal" means tomorrow when something is due.
- Use an existing ledger name when it is clearly the same person ("Sharma uncle" = "Sharma ji"). If two existing names could match, keep the spoken name and ask which one in "unclear".
- Keep names as spoken (same script). amount is a number in rupees. "quote" is the exact words this entry came from.
Note:
"""${transcript}"""`;
}

export function askPrompt(question: string, ledger: LedgerSnapshot, lang: Lang): string {
  return `You answer a small shop owner's question using ONLY the ledger data below.
If the data does not contain the answer, say so plainly. Never guess or calculate anything that is not a simple sum of the listed amounts.
Reply in ${LANG_NAME[lang]}, at most 3 short sentences, amounts as ₹ with Indian digit grouping.
Today is ${ledger.today}.
Data: ${JSON.stringify(ledger)}
Question: ${question}
Return JSON: {"answer":"..."}`;
}
