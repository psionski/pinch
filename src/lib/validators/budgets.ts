import { z } from "zod";

// YYYY-MM month format
const YearMonthSchema = z.string().regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format");

// ─── Set Budget ───────────────────────────────────────────────────────────────

export const SetBudgetSchema = z.object({
  categoryId: z.number().int().positive("Category ID is required"),
  month: YearMonthSchema,
  amount: z.number().int().positive("Amount must be a positive integer (cents)"),
  applyToFutureMonths: z.boolean().default(false),
});

export type SetBudgetInput = z.infer<typeof SetBudgetSchema>;

// ─── Get Budget Status ────────────────────────────────────────────────────────

export const GetBudgetStatusSchema = z.object({
  month: YearMonthSchema,
});

export type GetBudgetStatusInput = z.infer<typeof GetBudgetStatusSchema>;

// ─── Copy Budgets ─────────────────────────────────────────────────────────────

export const CopyBudgetsSchema = z.object({
  fromMonth: YearMonthSchema,
  toMonth: YearMonthSchema,
});

export type CopyBudgetsInput = z.infer<typeof CopyBudgetsSchema>;
