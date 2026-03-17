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

export interface SpendingGroup {
  key: string; // category name, YYYY-MM, or merchant name
  categoryId?: number | null;
  total: number; // cents
  count: number;
  compareTotal?: number; // cents — only present when compareDateFrom/To is set
}

export interface CategoryBreakdownItem {
  categoryId: number | null;
  categoryName: string | null;
  total: number; // cents
  count: number;
  percentage: number; // 0–100
}

export interface TrendPoint {
  month: string; // YYYY-MM
  total: number; // cents
  count: number;
}

export interface TopMerchant {
  merchant: string;
  total: number; // cents
  count: number;
  avgAmount: number; // cents
}

export interface BudgetStatusItem {
  categoryId: number;
  categoryName: string;
  budgetAmount: number; // cents
  spentAmount: number; // cents
  remainingAmount: number; // cents — can be negative
  percentUsed: number; // 0+, can exceed 100
  isOver: boolean;
}

export interface SpendingSummaryResult {
  period: { dateFrom: string; dateTo: string; total: number; count: number };
  comparePeriod?: { dateFrom: string; dateTo: string; total: number; count: number };
  groups: SpendingGroup[];
}

// ─── Month-only helper schemas ────────────────────────────────────────────────

export const MonthRangeSchema = z.object({
  month: YearMonthSchema,
});
export type MonthRangeInput = z.infer<typeof MonthRangeSchema>;
