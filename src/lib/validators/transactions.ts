import { z } from "zod";
import { PaginationSchema, IsoDateSchema, TransactionTypeSchema } from "./common";

// ─── Response ────────────────────────────────────────────────────────────────

export const TransactionResponseSchema = z.object({
  id: z.number().int(),
  amount: z.number().int(),
  type: z.enum(["income", "expense"]),
  description: z.string(),
  merchant: z.string().nullable(),
  categoryId: z.number().int().nullable(),
  date: z.string(),
  receiptId: z.number().int().nullable(),
  recurringId: z.number().int().nullable(),
  notes: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TransactionResponse = z.infer<typeof TransactionResponseSchema>;

export const PaginatedTransactionsResponseSchema = z.object({
  data: z.array(TransactionResponseSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
  hasMore: z.boolean(),
});

export type PaginatedTransactionsResponse = z.infer<typeof PaginatedTransactionsResponseSchema>;

// ─── Create ───────────────────────────────────────────────────────────────────

export const CreateTransactionSchema = z.object({
  amount: z.number().int().positive("Amount must be a positive integer (cents)"),
  type: TransactionTypeSchema.default("expense"),
  description: z.string().min(1, "Description is required").max(500),
  merchant: z.string().max(255).optional(),
  categoryId: z.number().int().positive().optional(),
  date: IsoDateSchema,
  receiptId: z.number().int().positive().optional(),
  recurringId: z.number().int().positive().optional(),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string().max(100)).max(20).optional(),
});

export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;

// ─── Update ───────────────────────────────────────────────────────────────────

export const UpdateTransactionSchema = z.object({
  amount: z.number().int().positive().optional(),
  type: TransactionTypeSchema.optional(),
  description: z.string().min(1).max(500).optional(),
  merchant: z.string().max(255).nullable().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  date: IsoDateSchema.optional(),
  notes: z.string().max(2000).nullable().optional(),
  tags: z.array(z.string().max(100)).max(20).nullable().optional(),
});

export type UpdateTransactionInput = z.infer<typeof UpdateTransactionSchema>;

// ─── Batch Create ─────────────────────────────────────────────────────────────

export const CreateTransactionsBatchSchema = z.object({
  transactions: z
    .array(CreateTransactionSchema)
    .min(1, "At least one transaction required")
    .max(100),
  receiptId: z.number().int().positive().optional(),
});

export type CreateTransactionsBatchInput = z.infer<typeof CreateTransactionsBatchSchema>;

// ─── List Filters ─────────────────────────────────────────────────────────────

export const ListTransactionsSchema = PaginationSchema.extend({
  dateFrom: IsoDateSchema.optional(),
  dateTo: IsoDateSchema.optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  amountMin: z.number().int().min(0).optional(),
  amountMax: z.number().int().min(0).optional(),
  merchant: z.string().max(255).optional(),
  search: z.string().max(255).optional(),
  tags: z.array(z.string().max(100)).optional(),
  type: TransactionTypeSchema.optional(),
  receiptId: z.number().int().positive().optional(),
  recurringId: z.number().int().positive().optional(),
  sortBy: z.enum(["date", "amount", "merchant", "createdAt"]).default("date"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type ListTransactionsInput = z.infer<typeof ListTransactionsSchema>;

// ─── Delete Batch ─────────────────────────────────────────────────────────────

export const DeleteTransactionsBatchSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, "At least one ID required").max(200),
});

export type DeleteTransactionsBatchInput = z.infer<typeof DeleteTransactionsBatchSchema>;
