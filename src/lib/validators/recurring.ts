import { z } from "zod";

// ISO 8601 date string: YYYY-MM-DD
const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

const TransactionTypeSchema = z.enum(["income", "expense"]);
const FrequencySchema = z.enum(["daily", "weekly", "monthly", "yearly"]);

// ─── Create ───────────────────────────────────────────────────────────────────

export const CreateRecurringSchema = z.object({
  amount: z.number().int().positive("Amount must be a positive integer (cents)"),
  type: TransactionTypeSchema.default("expense"),
  description: z.string().min(1, "Description is required").max(500),
  merchant: z.string().max(255).optional(),
  categoryId: z.number().int().positive().optional(),
  frequency: FrequencySchema,
  // For monthly: day of month (1–31). NULL means use the day from start_date.
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  // For weekly: 0=Sun, 1=Mon, …, 6=Sat. NULL means use day from start_date.
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  startDate: IsoDateSchema,
  endDate: IsoDateSchema.nullable().optional(),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string().max(100)).max(20).optional(),
});

export type CreateRecurringInput = z.infer<typeof CreateRecurringSchema>;

// ─── Update ───────────────────────────────────────────────────────────────────

export const UpdateRecurringSchema = z.object({
  amount: z.number().int().positive().optional(),
  type: TransactionTypeSchema.optional(),
  description: z.string().min(1).max(500).optional(),
  merchant: z.string().max(255).nullable().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  frequency: FrequencySchema.optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  startDate: IsoDateSchema.optional(),
  endDate: IsoDateSchema.nullable().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
  tags: z.array(z.string().max(100)).max(20).nullable().optional(),
});

export type UpdateRecurringInput = z.infer<typeof UpdateRecurringSchema>;

// ─── Generate Pending ─────────────────────────────────────────────────────────

export const GenerateRecurringSchema = z.object({
  upToDate: IsoDateSchema,
});

export type GenerateRecurringInput = z.infer<typeof GenerateRecurringSchema>;

// ─── Delete Options ───────────────────────────────────────────────────────────

export const DeleteRecurringSchema = z.object({
  deleteFutureTransactions: z.boolean().default(false),
});

export type DeleteRecurringInput = z.infer<typeof DeleteRecurringSchema>;
