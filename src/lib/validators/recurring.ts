import { z } from "zod";
import { IsoDateSchema, TransactionTypeSchema, FrequencySchema } from "./common";

// ─── Response ────────────────────────────────────────────────────────────────

export const RecurringResponseSchema = z.object({
  id: z.number().int(),
  amount: z.number().int(),
  type: z.enum(["income", "expense"]),
  description: z.string(),
  merchant: z.string().nullable(),
  categoryId: z.number().int().nullable(),
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  dayOfMonth: z.number().int().nullable(),
  dayOfWeek: z.number().int().nullable(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  lastGenerated: z.string().nullable(),
  isActive: z.number().int(),
  notes: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  nextOccurrence: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type RecurringResponse = z.infer<typeof RecurringResponseSchema>;

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
