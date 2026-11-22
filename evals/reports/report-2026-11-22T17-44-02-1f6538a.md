# Dukaan Yaad eval report

- Generated: 2026-11-22T17:44:02.584Z
- Git commit: `1f6538a`
- Prompt version: `v1`
- Online providers with keys: none (offline path only)

## Extraction
> Test set written during development (not yet collected from shop owners); every case is scored as the owner would see it.

Cases: 60. Paths run: offline.

### By path
| Group | Cases | Invented values (target 0) | Type + amount correct (90%+) | Correct party (95%+) | Wrong person | Asks when unclear (100%) | Dates correct | Caught by guard |
|---|---|---|---|---|---|---|---|---|
| offline | 60 | 0 | 99% | 93% | 2 | 100% | 99% | 0 |

### By path and language
| Group | Cases | Invented values (target 0) | Type + amount correct (90%+) | Correct party (95%+) | Wrong person | Asks when unclear (100%) | Dates correct | Caught by guard |
|---|---|---|---|---|---|---|---|---|
| offline · en | 10 | 0 | 100% | 100% | 0 | 100% | 100% | 0 |
| offline · gu | 8 | 0 | 100% | 100% | 0 | 100% | 100% | 0 |
| offline · hi | 33 | 0 | 98% | 88% | 2 | 100% | 98% | 0 |
| offline · mr | 9 | 0 | 100% | 100% | 0 | n/a | 100% | 0 |

### By path and category
| Group | Cases | Invented values (target 0) | Type + amount correct (90%+) | Correct party (95%+) | Wrong person | Asks when unclear (100%) | Dates correct | Caught by guard |
|---|---|---|---|---|---|---|---|---|
| offline · corrections | 6 | 0 | 100% | 100% | 0 | n/a | 100% | 0 |
| offline · held_out | 15 | 0 | 95% | 79% | 2 | 100% | 95% | 0 |
| offline · noise | 6 | 0 | 100% | 75% | 1 | 100% | 100% | 0 |
| offline · relative_dates | 15 | 0 | 100% | 100% | 0 | n/a | 100% | 0 |
| offline · settling | 15 | 0 | 100% | 100% | 0 | n/a | 100% | 0 |
| offline · several_entries | 10 | 0 | 100% | 73% | 1 | n/a | 100% | 0 |
| offline · similar_names | 4 | 0 | 100% | 100% | 0 | 100% | 100% | 0 |

### Failing cases
- `ho-01` (offline): 1 wrong person
- `ho-05` (offline): 1 wrong person
- `ho-08` (offline): type+amount 1/2

_"Invented values" counts values in the final cards (after the never-invent guard) that are not in the note. "Caught by guard" counts values the model produced that the guard removed before the owner saw them._

## Ask (Poochho)
> Test set written during development, run against the saved-ledger fixture.

| Path | Cases | Answers match saved data (target 100%) |
|---|---|---|
| local | 16 | 100% |

<details><summary>Answers</summary>

- ✅ `ask-hi-01` (local): Sharma ji ka ₹650 udhaar baaki hai.
- ✅ `ask-hi-02` (local): Sharma uncle ka ₹120 udhaar baaki hai.
- ✅ `ask-hi-03` (local): Kal tak dena hai: Ramesh distributor ₹8,200 (der ho gayi), Gupta Traders ₹1,800 (kal).
- ✅ `ask-hi-04` (local): Mangwana hai: Tata namak (Gupta Traders), Maggi.
- ✅ `ask-hi-05` (local): Customers se kul ₹1,120 milna hai (3 log).
- ✅ `ask-hi-06` (local): Suppliers ko kul ₹10,000 dena hai (2 log).
- ✅ `ask-hi-07` (local): Yeh saved hisaab mein nahi mila. Naam waise hi bolo jaise save kiya tha.
- ✅ `ask-hi-08` (local): Der ho gayi: Ramesh distributor ₹8,200.
- ✅ `ask-hi-09` (local): Meena didi ka order: 5 kilo atta (kal).
- ✅ `ask-hi-10` (local): Verma ji ka ₹350 udhaar baaki hai.
- ✅ `ask-hi-11` (local): Baaki orders: Meena didi: 5 kilo atta (kal).
- ✅ `ask-en-01` (local): Sharma ji owes you ₹650.
- ✅ `ask-en-02` (local): To reorder: Tata namak (Gupta Traders), Maggi.
- ✅ `ask-en-03` (local): Due by tomorrow: Ramesh distributor ₹8,200 (overdue), Gupta Traders ₹1,800 (tomorrow).
- ✅ `ask-mr-01` (local): Sharma ji यांचे ₹650 उधार बाकी आहे.
- ✅ `ask-gu-01` (local): કાલ સુધી આપવાના: Ramesh distributor ₹8,200 (મોડું), Gupta Traders ₹1,800 (કાલે).

</details>

## Speech-to-text

_Skipped (--skip-stt)._
