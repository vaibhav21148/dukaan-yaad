import { z } from 'zod';
import { ENTRY_TYPES, type ExtractedEntry } from './types.js';

const nullableStr = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (typeof v === 'string' && v.trim() ? v.trim() : null));

export const EntrySchema = z.object({
  type: z.enum(ENTRY_TYPES as [string, ...string[]]),
  party: nullableStr,
  amount: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v === null || v === undefined || v === '') return null;
      const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.]/g, ''));
      return Number.isFinite(n) && n > 0 ? n : null;
    }),
  item: nullableStr,
  due: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (typeof v === 'string' && /^\d{4}-\d\d-\d\d$/.test(v) ? v : null)),
  unclear: nullableStr,
  quote: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (v ?? '').trim()),
});

/** Lenient on the envelope: invalid entries are dropped, not the whole result. */
export const ExtractResultSchema = z
  .object({ entries: z.array(z.unknown()).default([]) })
  .transform(({ entries }) =>
    entries
      .map((e) => EntrySchema.safeParse(e))
      .filter((r) => r.success)
      .map((r) => r.data as ExtractedEntry),
  );

/** JSON Schema given to providers' structured-output modes. */
export const EXTRACT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    entries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ENTRY_TYPES },
          party: { type: ['string', 'null'] },
          amount: { type: ['number', 'null'] },
          item: { type: ['string', 'null'] },
          due: { type: ['string', 'null'], description: 'YYYY-MM-DD or null' },
          unclear: { type: ['string', 'null'] },
          quote: { type: 'string' },
        },
        required: ['type', 'party', 'amount', 'item', 'due', 'unclear', 'quote'],
        additionalProperties: false,
      },
    },
  },
  required: ['entries'],
  additionalProperties: false,
} as const;

export const AskResultSchema = z.object({ answer: z.string().min(1) });

export const EXTRACT_REQUEST = z.object({
  transcript: z.string().min(1).max(4000),
  parties: z.array(z.string().max(80)).max(200).default([]),
  today: z.string().regex(/^\d{4}-\d\d-\d\d$/),
  lang: z.enum(['hi', 'en', 'mr', 'gu']).default('hi'),
});

export const ASK_REQUEST = z.object({
  question: z.string().min(1).max(500),
  lang: z.enum(['hi', 'en', 'mr', 'gu']).default('hi'),
  ledger: z.object({
    today: z.string(),
    suppliers_owed: z.array(z.any()).max(300),
    customers_owe: z.array(z.any()).max(300),
    to_reorder: z.array(z.any()).max(300),
    pending_orders: z.array(z.any()).max(300),
  }),
});
