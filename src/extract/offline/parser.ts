// Offline, rule-based note parser. Ported from the prototype's heuristic() and extended
// for four languages, number words, corrections and multi-item sentences.
// It only copies what was spoken: it never fills a value that is not in the note.
import { resolveDate } from '../../../shared/dates';
import { doubt } from '../../../shared/messages';
import { normalizeNumbers, UNIT_RE } from '../../../shared/numbers';
import { hasIndicScript } from '../../../shared/translit';
import { matchParty, nameCore } from '../../../shared/names';
import type { EntryType, ExtractedEntry, Lang } from '../../../shared/types';
import { CONJUNCTIONS, FILLER, GLUED, KW, MARKERS, SUPPLIER_HINTS, TIME_WORDS } from './keywords';

export interface KnownParty {
  name: string;
  aliases: string[];
  side: 'supplier' | 'customer' | null;
}
export interface ParseContext {
  today: string;
  lang: Lang;
  parties?: KnownParty[];
}

type Intent = EntryType | 'balance' | 'correction';

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (words: string[]) =>
  new RegExp(`(?<![\\p{L}\\p{M}])(?:${[...words].sort((a, b) => b.length - a.length).map((w) => esc(w).replace(/ /g, '\\s+')).join('|')})(?![\\p{L}\\p{M}])`, 'iu');

const RE = {
  stockOut: wordRe(KW.stockOut),
  credit: wordRe(KW.credit),
  balance: wordRe(KW.balance),
  received: wordRe(KW.received),
  receivedStrong: wordRe(['wapas', 'vapas', 'jama', 'chuka', 'chuka diye', 'chukaye', 'chukta', 'lauta', 'mil gaye', 'mil gaya', 'mile', 'paid back', 'returned', 'gave back', 'received', 'वापस', 'जमा', 'चुका', 'लौटा', 'मिल गए', 'मिले', 'परत', 'मिळाले', 'मिळाला', 'पाछा', 'પાછા', 'જમા', 'મળ્યા', 'મળી ગયા', 'parat', 'milale', 'malya']),
  paid: wordRe(KW.paid),
  due: wordRe(KW.due),
  order: wordRe(KW.order),
  correction: wordRe(KW.correction),
  correctionStart: new RegExp(`^\\s*(?:${KW.correction.map(esc).join('|')})(?![\\p{L}\\p{M}])`, 'iu'),
  conjCapture: new RegExp(`(\\s+(?:${CONJUNCTIONS.map(esc).join('|')})\\s+)`, 'iu'),
  supplierHint: wordRe(SUPPLIER_HINTS),
  lena: wordRe(['lena', 'lena hai', 'lene', 'lene hai', 'lene hain', 'लेना', 'लेने', 'घ्यायचे', 'येणे', 'લેવાના', 'levana']),
};

const MARKER_ALL = new Map<string, 'agent' | 'to' | 'of'>();
for (const role of ['of', 'to', 'agent'] as const) for (const m of MARKERS[role]) MARKER_ALL.set(m.toLowerCase(), role);
const FILLER_SET = new Set(FILLER.map((f) => f.toLowerCase()));
const TIME_SET = new Set(TIME_WORDS.map((f) => f.toLowerCase()));
const KEYWORD_WORDS = new Set(
  [...KW.stockOut, ...KW.credit, ...KW.balance, ...KW.received, ...KW.paid, ...KW.due, ...KW.order]
    .filter((w) => !w.includes(' '))
    .map((w) => w.toLowerCase()),
);

/** Split into clauses on punctuation (but not inside numbers like 2.5 or 1,500). */
export function splitClauses(text: string): string[] {
  return text
    .replace(/\.{2,}|…/g, ' ') // "500... nahi 400": a pause, not a new clause
    .split(/,(?!\d{3}(?!\d))|;|\||\n|।|\?|!|\.(?!\d)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function detectIntent(raw: string, glued: boolean): Intent | null {
  const l = normalizeNumbers(raw);
  const hasNum = /\d/.test(l);
  if (RE.correctionStart.test(l) && (hasNum || resolveDate(l, '2000-01-01')) && !RE.stockOut.test(l) && !RE.order.test(l)) {
    // "nahi, 300 tha" / "nahi nahi 300" -> correction of the previous entry
    const rest = l.replace(RE.correctionStart, '');
    if (!RE.credit.test(rest) && !RE.received.test(rest) && !RE.due.test(rest) && !RE.paid.test(rest)) return 'correction';
  }
  if (RE.stockOut.test(l) && !RE.credit.test(l)) return 'reorder';
  if (RE.order.test(l)) return 'pending_order';
  if (RE.lena.test(l)) return 'credit_given';
  if (RE.credit.test(l)) return RE.receivedStrong.test(l) ? 'credit_received' : 'credit_given';
  if (RE.received.test(l) || RE.paid.test(l)) {
    const role = findMarker(raw, glued)?.role;
    if (role === 'agent') return 'credit_received';
    if (role === 'to') return 'supplier_paid';
    if (!hasIndicScript(raw)) {
      if (/\b(paid back|returned|gave back|received|got)\b/i.test(l)) return 'credit_received';
      if (/^\s*(i|we)\b/i.test(l) || /^\s*(paid|gave|sent)\b/i.test(l)) return 'supplier_paid';
      if (/^\s*[a-z][a-z .']*?\s+(paid|gave)\b/i.test(l)) return 'credit_received';
    }
    if (RE.receivedStrong.test(l)) return 'credit_received';
    if (RE.paid.test(l) && !RE.due.test(l.replace(RE.paid, ' '))) return 'supplier_paid';
  }
  if (RE.due.test(l)) return 'supplier_due';
  if (RE.balance.test(l)) return 'balance';
  return null;
}

interface MarkerHit {
  index: number; // token index of the marker (or the glued word)
  role: 'agent' | 'to' | 'of';
  glued: string | null; // suffix glued to the name
}

function tokens(s: string): string[] {
  return s.split(/\s+/).filter(Boolean);
}

function findMarker(piece: string, glued: boolean): MarkerHit | null {
  const t = tokens(piece);
  for (let i = 0; i < t.length; i++) {
    const w = t[i].toLowerCase().replace(/[^\p{L}\p{M}']/gu, '');
    if (i > 0 && MARKER_ALL.has(w)) return { index: i, role: MARKER_ALL.get(w)!, glued: null };
    if (glued && hasIndicScript(w) && !KEYWORD_WORDS.has(w)) {
      for (const role of ['agent', 'to', 'of'] as const) {
        for (const g of GLUED[role]) {
          if (w.length > g.length + 1 && w.endsWith(g)) return { index: i, role, glued: g };
        }
      }
    }
    if (/'s$/.test(w) && w.length > 3) return { index: i, role: 'of', glued: "'s" };
  }
  return null;
}

function trimFiller(words: string[]): string[] {
  const w = [...words];
  while (w.length && (FILLER_SET.has(w[0].toLowerCase()) || /^\d/.test(w[0]))) w.shift();
  while (w.length && (FILLER_SET.has(w[w.length - 1].toLowerCase()) || /^\d/.test(w[w.length - 1]))) w.pop();
  return w;
}

/** The name spoken before a case marker, e.g. "Ramesh distributor ko ..." -> "Ramesh distributor". */
function partyBefore(piece: string, hit: MarkerHit | null): string | null {
  const t = tokens(piece);
  if (hit) {
    let words = t.slice(0, hit.index + (hit.glued ? 1 : 0));
    if (hit.glued && words.length) {
      const last = words[words.length - 1];
      words[words.length - 1] = last.slice(0, last.length - hit.glued.length).replace(/\u093E\u0902$/, '\u093E').replace(/\u0902$/, '');
    }
    // a number splits the clause: keep words after the last number
    const lastNum = words.map((w) => /\d/.test(w)).lastIndexOf(true);
    if (lastNum >= 0) words = words.slice(lastNum + 1);
    words = trimFiller(words.map((w) => w.replace(/[^\p{L}\p{M}\d.'-]/gu, '')).filter(Boolean)).slice(-4);
    const name = words.join(' ').trim();
    if (name && !KEYWORD_WORDS.has(name.toLowerCase()) && /[\p{L}]/u.test(name)) return name;
  }
  // English word orders
  if (!hasIndicScript(piece) && !hit) {
    const pats = [
      /^\s*(?:i\s+|we\s+)?(?:paid|gave|pay|owe|sent|have to pay|need to pay|to pay)\s+(?:to\s+)?([a-z][a-z.' ]*?)\s+(?:rs\.?\s*|₹\s*)?\d/i,
      /\b(?:from|by)\s+([a-z][a-z.' ]*?)(?=\s+\d|\s*$|\s+(?:today|tomorrow|by|on)\b)/i,
      /\bto\s+([a-z][a-z.' ]*?)(?=\s+\d|\s*$|\s+(?:by|on|today|tomorrow)\b)/i,
      /^\s*([a-z][a-z.' ]*?)\s+(?:paid|gave|returned|took|owes|ordered|needs|wants|has)\b/i,
    ];
    for (const p of pats) {
      const m = p.exec(piece);
      if (m) {
        const words = trimFiller(tokens(m[1]));
        const name = words.join(' ');
        if (name && !/^(i|we|me|him|her|them)$/i.test(name) && !KEYWORD_WORDS.has(name.toLowerCase())) return name;
      }
    }
  }
  return null;
}

/** Pick the rupee amount from a clause; skip quantities ("2 kilo") and day numbers. */
export function pickAmount(normPiece: string): number | null {
  const re = /(\d+(?:\.\d+)?)/g;
  const found: { v: number; pos: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(normPiece))) {
    const after = normPiece.slice(m.index + m[0].length).trimStart();
    const nextWord = (after.match(/^[\p{L}\p{M}₹]+/u) ?? [''])[0];
    const before = normPiece.slice(0, m.index).trimEnd();
    const currency = /^(rs|rupaye|rupaya|rupees|rupee|₹|रुपये|रुपए|रुपया|રૂપિયા)$/i.test(nextWord) || /(₹|rs\.?)$/i.test(before);
    if (!currency && nextWord && UNIT_RE.test(nextWord)) continue;
    if (/^(tarikh|tareekh|taarikh|tarik|तारीख|તારીખ|st|nd|rd|th|din|dino|दिन|दिवस|દિવસ|days?|baje|बजे|vajta|વાગ્યે|jan[a-z]*|feb[a-z]*|mar[a-z]*|apr[a-z]*|may|jun[a-z]*|jul[a-z]*|aug[a-z]*|sep[a-z]*|oct[a-z]*|nov[a-z]*|dec[a-z]*)$/iu.test(nextWord)) continue;
    found.push({ v: Number(m[1]), pos: m.index });
  }
  if (!found.length) return null;
  // "500 nahi 300" -> the number after the last correction word
  const corr = [...normPiece.matchAll(new RegExp(RE.correction.source, 'giu'))].map((x) => x.index ?? 0);
  if (corr.length > 0 && found.length > 1) {
    const lastCorr = corr[corr.length - 1];
    const after = found.filter((f) => f.pos > lastCorr);
    if (after.length) return after[0].v;
  }
  return found[0].v > 0 ? found[0].v : null;
}

function cleanItem(s: string): string | null {
  let words = s
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{M}\d]+|[^\p{L}\p{M}\d)-]+$/gu, ''))
    .filter(Boolean)
    .filter((w) => !TIME_SET.has(w.toLowerCase()));
  while (words.length && FILLER_SET.has(words[0].toLowerCase())) words.shift();
  const lead: string[] = [];
  while (words.length && (/^\d/.test(words[0]) || UNIT_RE.test(words[0]))) lead.push(words.shift()!);
  const body = trimFiller(words);
  if (!body.length) return null;
  const all = [...lead, ...body].join(' ').trim();
  return /[\p{L}]/u.test(all) ? all : null;
}

function itemsFromReorder(piece: string, glued: boolean): { items: string[]; supplier: string | null } {
  let before = piece;
  const m = RE.stockOut.exec(piece);
  if (m) before = piece.slice(0, m.index);
  if (!before.trim() && m) before = piece.slice(m.index + m[0].length);
  // "Ramesh se Maggi mangwana" -> supplier Ramesh
  let supplier: string | null = null;
  const hit = findMarker(before, glued);
  if (hit && hit.role === 'agent') {
    supplier = partyBefore(before, hit);
    const t = tokens(before);
    before = t.slice(hit.index + 1).join(' ');
  }
  const items = before
    .split(new RegExp(`\\s+(?:${CONJUNCTIONS.map(esc).join('|')})\\s+|\\s*[/&+,]\\s*`, 'iu'))
    .map((x) => x.replace(/\b(ka|ki|ke)\s+stock\b/gi, ' ').replace(/\b(bhi|wala|wali|wale)\b/gi, ' '))
    .map(cleanItem)
    .filter((x): x is string => !!x);
  return { items, supplier };
}

function orderItem(piece: string, party: string | null): string | null {
  const n = normalizeNumbers(piece);
  const m = RE.order.exec(n);
  let rest = m ? n.slice(m.index + m[0].length) : n;
  if (!rest.trim() && m) rest = n.slice(0, m.index);
  if (party) rest = rest.replace(new RegExp(esc(party), 'i'), ' ');
  // remove weekdays and relative dates from the item text
  rest = rest.replace(/(?<![\p{L}\p{M}])(monday|tuesday|wednesday|thursday|friday|saturday|sunday|somvar|mangalvar|budhvar|guruvar|shukravar|shanivar|ravivar|parso|kal|aaj)(?![\p{L}\p{M}])/giu, ' ');
  return cleanItem(rest.replace(/\s+/g, ' '));
}

/** No case marker: take the leading words before the first number or keyword ("Gupta ji 2 packet le gaye"). */
function leadingName(piece: string): string | null {
  const t = tokens(piece);
  const words: string[] = [];
  for (const w of t) {
    const lw = w.toLowerCase();
    if (/\d/.test(w) || KEYWORD_WORDS.has(lw) || RE.credit.test(lw) || RE.received.test(lw)) break;
    words.push(w.replace(/[^\p{L}\p{M}.'-]/gu, ''));
  }
  const name = trimFiller(words.filter(Boolean));
  if (name.length < 1 || name.length > 4 || name.length === t.length) return null;
  return name.join(' ');
}

function isSupplierish(name: string | null, ctx: ParseContext): boolean {
  if (!name) return false;
  if (RE.supplierHint.test(name)) return true;
  const known = ctx.parties ?? [];
  const m = matchParty(name, known.map((p, i) => ({ id: String(i), name: p.name, aliases: p.aliases })));
  if (m.kind === 'exact' || m.kind === 'one') return known[Number(m.party.id)]?.side === 'supplier';
  return false;
}

function hasContent(piece: string, glued: boolean): boolean {
  return /\d/.test(normalizeNumbers(piece)) || !!findMarker(piece, glued);
}

/** Main entry point: note text -> extracted entries (unconfirmed). */
export function parseOffline(text: string, ctx: ParseContext): ExtractedEntry[] {
  const out: ExtractedEntry[] = [];
  const lang = ctx.lang;
  const clauses = splitClauses(text);
  let pendingCorrection = false; // "no wait," on its own: the next bare number corrects the last entry
  let prevClauseEntries = 0;
  let startOfPrev = 0;
  for (let ci = 0; ci < clauses.length; ci++) {
    prevClauseEntries = out.length - startOfPrev;
    const clause = clauses[ci];
    const glued = lang === 'mr' || lang === 'gu' || /[\u0A80-\u0AFF]/.test(clause);
    const normClause = normalizeNumbers(clause);
    const last = out[out.length - 1];
    // "no wait" / "nahi" alone
    if (RE.correctionStart.test(clause) && !normClause.replace(RE.correctionStart, '').replace(/\b(wait|ruko|matlab|sorry|i mean)\b/gi, '').trim()) {
      pendingCorrection = true;
      continue;
    }
    // ", 250" / ", 120 rupaye" / "250 tha": a bare amount belongs to the entry just before it
    const bare = /^(?:₹|rs\.?)?\s*(\d+(?:\.\d+)?)\s*(?:rupaye|rupaya|rupees|rs|₹|रुपये|रुपए|રૂપિયા|tha|the|thi|था|थे|होते|હતા)?\s*$/i.exec(normClause.trim());
    if (bare && last && last.type !== 'reorder' && (pendingCorrection || last.amount == null)) {
      last.amount = Number(bare[1]);
      if (last.unclear && /kitna|kitne|how much|किती|કેટલ|rakam|amount|रक्कम|રકમ/i.test(last.unclear)) last.unclear = null;
      last.quote = `${last.quote}, ${clause}`;
      pendingCorrection = false;
      continue;
    }
    pendingCorrection = false;
    const clauseIntent = detectIntent(clause, glued);
    // "Parle-G, Maggi aur Tata namak khatam": a bare item before a stock-out clause joins it
    if (!clauseIntent && !hasContent(clause, glued) && ci + 1 < clauses.length && detectIntent(clauses[ci + 1], glued) === 'reorder') {
      clauses[ci + 1] = `${clause}, ${clauses[ci + 1]}`;
      continue;
    }
    // "Meena's order for tomorrow, 5 kg atta": the item said after the order
    if (!clauseIntent && last && last.type === 'pending_order' && prevClauseEntries > 0 && !findMarker(clause, glued)) {
      const it = cleanItem(normClause);
      if (it) {
        last.item = last.item && last.item.length > 3 ? `${last.item}, ${it}` : it;
        last.quote = `${last.quote}, ${clause}`;
        continue;
      }
    }
    const before = out.length;
    startOfPrev = before;
    // split on "aur" etc., then glue item lists back together
    const parts = clause.split(RE.conjCapture);
    const pieces: { text: string; sep: string; intent: Intent | null }[] = [];
    for (let i = 0; i < parts.length; i += 2) {
      const text = parts[i].trim();
      if (!text) continue;
      pieces.push({ text, sep: parts[i + 1] ?? ' ', intent: detectIntent(text, glued) });
    }
    // merge "Parle-G" + "Maggi khatam" -> "Parle-G aur Maggi khatam" (original words kept)
    const merged: { text: string; sep: string; intent: Intent | null }[] = [];
    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i];
      const next = pieces[i + 1];
      const noNum = !/\d/.test(normalizeNumbers(p.text));
      const nextBare = !!next && !!next.intent && !/\d/.test(normalizeNumbers(next.text)) && !findMarker(next.text, glued);
      if (!p.intent && next && (!hasContent(p.text, glued) || (noNum && next.intent === 'reorder') || (nextBare && next.intent !== 'reorder'))) {
        const text = `${p.text}${p.sep}${next.text}`;
        pieces[i + 1] = { text, sep: next.sep, intent: next.intent ?? detectIntent(text, glued) };
        continue;
      }
      if (!p.intent && !hasContent(p.text, glued) && merged.length) {
        const prev = merged[merged.length - 1];
        prev.text = `${prev.text}${prev.sep}${p.text}`;
        prev.sep = p.sep;
        continue;
      }
      merged.push({ ...p });
    }
    // pieces with a name/number but no verb inherit the neighbour's intent
    for (let i = 0; i < merged.length; i++) {
      if (merged[i].intent) continue;
      const prev = merged.slice(0, i).reverse().find((x) => x.intent && x.intent !== 'correction');
      const next = merged.slice(i + 1).find((x) => x.intent && x.intent !== 'correction');
      const inherit = prev?.intent ?? next?.intent ?? null;
      if (inherit && inherit !== 'reorder' && inherit !== 'pending_order') merged[i].intent = inherit;
    }

    for (const p of merged) {
      const piece = p.text;
      const norm = normalizeNumbers(piece);
      const base = { party: null as string | null, amount: null as number | null, item: null as string | null, due: null as string | null, unclear: null as string | null, quote: piece };

      if (p.intent === 'correction') {
        const prev = out[out.length - 1];
        if (prev) {
          const amt = pickAmount(norm);
          const d = resolveDate(norm, ctx.today);
          if (amt != null && prev.type !== 'reorder') {
            prev.amount = amt;
            if (prev.unclear && /kitna|how much|किती|કેટલ|rakam|amount|रक्कम|રકમ/i.test(prev.unclear)) prev.unclear = null;
          } else if (d && (prev.type === 'supplier_due' || prev.type === 'pending_order')) prev.due = d;
          prev.quote = `${prev.quote}, ${piece}`;
        }
        continue;
      }

      if (p.intent === 'reorder') {
        const { items, supplier } = itemsFromReorder(norm, glued);
        if (!items.length) out.push({ ...base, type: 'reorder', party: supplier, unclear: doubt(lang, 'whatItem') });
        for (const it of items) out.push({ ...base, type: 'reorder', party: supplier, item: it });
        continue;
      }

      const hit = findMarker(piece, glued);
      let party = partyBefore(piece, hit);
      if (!party && p.intent && p.intent !== 'pending_order') party = leadingName(norm);
      // "Bharat distributor ko 2000 de diye aur 3000 abhi baaki hai": same person, name said once
      if (!party && out.length > before && p.intent !== 'pending_order') party = out[out.length - 1].party;
      const amount = pickAmount(norm);
      const need = (q: Parameters<typeof doubt>[1]) => doubt(lang, q);

      if (p.intent === 'pending_order') {
        if (isSupplierish(party, ctx)) {
          const item = orderItem(piece, party);
          out.push({ ...base, type: 'reorder', party, item, unclear: item ? null : need('whatItem') });
          continue;
        }
        out.push({ ...base, type: 'pending_order', party, amount, item: orderItem(piece, party), due: resolveDate(norm, ctx.today), unclear: party ? null : need('whoName') });
        continue;
      }

      let type: EntryType | null = null;
      switch (p.intent) {
        case 'credit_received':
          type = 'credit_received';
          break;
        case 'supplier_paid':
          type = 'supplier_paid';
          break;
        case 'supplier_due':
          type = 'supplier_due';
          break;
        case 'credit_given':
          type = isSupplierish(party, ctx) && !RE.lena.test(norm) ? 'supplier_due' : 'credit_given';
          break;
        case 'balance':
          type = isSupplierish(party, ctx) ? 'supplier_due' : 'credit_given';
          break;
        default:
          type = null;
      }

      if (!type) {
        if (!hasContent(piece, glued)) continue; // "haan", "theek hai", noise
        out.push({ ...base, type: 'credit_given', party, amount, unclear: need('notUnderstood') });
        continue;
      }
      const qByType: Record<string, Parameters<typeof doubt>[1]> = {
        supplier_due: 'howMuchDue',
        supplier_paid: 'howMuchPaid',
        credit_given: 'howMuchCredit',
        credit_received: 'howMuchReceived',
      };
      const unclear = !party ? need('whoName') : amount == null ? need(qByType[type]) : null;
      out.push({
        ...base,
        type,
        party,
        amount,
        due: type === 'supplier_due' ? resolveDate(norm, ctx.today) : null,
        unclear: !party && amount == null ? `${need('whoName')} ${need(qByType[type])}` : unclear,
      });
    }
  }
  return out.map((e) => ({ ...e, party: e.party ? tidyName(e.party) : null }));
}

function tidyName(n: string): string {
  const t = n.trim().replace(/\s+/g, ' ');
  // Capitalise Roman names for display: "sharma ji" -> "Sharma ji"
  return hasIndicScript(t) ? t : t.replace(/^\p{Ll}/u, (c) => c.toUpperCase());
}

export { nameCore };
