import { z } from "zod";
import { IsoDateSchema, YearMonthSchema } from "./common";

// ─── Spending Summary ─────────────────────────────────────────────────────────

export const SpendingSummarySchema = z.object({
  dateFrom: IsoDateSchema,
  dateTo: IsoDateSchema,
  groupBy: z.enum(["category", "month", "merchant"]).default("category"),
  type: z.enum(["income", "expense", "all"]).default("expense"),
  /** Optional: compare totals against a different period */
  compareDateFrom: IsoDateSchema.optional(),
  compareDateTo: IsoDateSchema.optional(),
});

export type SpendingSummaryInput = z.infer<typeof SpendingSummarySchema>;

// ─── Category Breakdown ───────────────────────────────────────────────────────

export const CategoryBreakdownSchema = z.object({
  dateFrom: IsoDateSchema,
  dateTo: IsoDateSchema,
  type: z.enum(["income", "expense"]).default("expense"),
});

export type CategoryBreakdownInput = z.infer<typeof CategoryBreakdownSchema>;

// ─── Trends ───────────────────────────────────────────────────────────────────

export const TrendsSchema = z.object({
  /** Number of months to look back (inclusive of current) */
  months: z.number().int().min(1).max(24).default(6),
  categoryId: z.number().int().positive().optional(),
  type: z.enum(["income", "expense", "all"]).default("expense"),
});

export type TrendsInput = z.infer<typeof TrendsSchema>;

// ─── Top Merchants ────────────────────────────────────────────────────────────

export const TopMerchantsSchema = z.object({
  dateFrom: IsoDateSchema,
  dateTo: IsoDateSchema,
  limit: z.number().int().min(1).max(100).default(10),
  type: z.enum(["income", "expense", "all"]).default("expense"),
});

export type TopMerchantsInput = z.infer<typeof TopMerchantsSchema>;

// ─── Return types ─────────────────────────────────────────────────────────────

export const SpendingGroupSchema = z.object({
  key: z.string(), // category name, YYYY-MM, or merchant name
  categoryId: z.number().int().nullable().optional(),
  total: z.number().int(), // cents
  count: z.number().int(),
  compareTotal: z.number().int().optional(), // only present when compareDateFrom/To is set
});

export type SpendingGroup = z.infer<typeof SpendingGroupSchema>;

export const CategoryBreakdownItemSchema = z.object({
  categoryId: z.number().int().nullable(),
  categoryName: z.string().nullable(),
  total: z.number().int(), // cents
  count: z.number().int(),
  percentage: z.number(), // 0–100
});

export type CategoryBreakdownItem = z.infer<typeof CategoryBreakdownItemSchema>;

export const TrendPointSchema = z.object({
  month: z.string(), // YYYY-MM
  total: z.number().int(), // cents
  count: z.number().int(),
});

export type TrendPoint = z.infer<typeof TrendPointSchema>;

export const TopMerchantSchema = z.object({
  merchant: z.string(),
  total: z.number().int(), // cents
  count: z.number().int(),
  avgAmount: z.number().int(), // cents
});

export type TopMerchant = z.infer<typeof TopMerchantSchema>;

export const BudgetStatusItemSchema = z.object({
  categoryId: z.number().int(),
  categoryName: z.string(),
  budgetAmount: z.number().int(), // cents
  spentAmount: z.number().int(), // cents
  remainingAmount: z.number().int(), // cents — can be negative
  percentUsed: z.number(), // 0+, can exceed 100
  isOver: z.boolean(),
});

export type BudgetStatusItem = z.infer<typeof BudgetStatusItemSchema>;

const PeriodSchema = z.object({
  dateFrom: z.string(),
  dateTo: z.string(),
  total: z.number().int(),
  count: z.number().int(),
});

export const SpendingSummaryResultSchema = z.object({
  period: PeriodSchema,
  comparePeriod: PeriodSchema.optional(),
  groups: z.array(SpendingGroupSchema),
});

export type SpendingSummaryResult = z.infer<typeof SpendingSummaryResultSchema>;

// ─── Month-only helper schemas ────────────────────────────────────────────────

export const MonthRangeSchema = z.object({
  month: YearMonthSchema,
});
export type MonthRangeInput = z.infer<typeof MonthRangeSchema>;
