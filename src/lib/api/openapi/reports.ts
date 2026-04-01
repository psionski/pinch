import { z } from "zod";
import {
  SpendingSummarySchema,
  CategoryStatsSchema,
  BudgetStatsSchema,
  TrendsSchema,
  TopMerchantsSchema,
  SpendingSummaryResultSchema,
  CategorySpendingItemSchema,
  BudgetStatsItemSchema,
  TrendPointSchema,
  TopMerchantSchema,
} from "@/lib/validators/reports";
import { op } from "./helpers";

const SummaryResult = SpendingSummaryResultSchema.meta({ id: "SpendingSummaryResult" });
const CategorySpendingItem = CategorySpendingItemSchema.meta({ id: "CategorySpendingItem" });
const BudgetStatsItem = BudgetStatsItemSchema.meta({ id: "BudgetStatsItem" });
const Trend = TrendPointSchema.meta({ id: "TrendPoint" });
const Merchant = TopMerchantSchema.meta({ id: "TopMerchant" });

export const reportPaths = {
  "/api/reports/summary": {
    get: op({
      id: "spendingSummary",
      summary: "Spending summary grouped by category, month, or merchant",
      tags: ["Reports"],
      query: SpendingSummarySchema,
      response: SummaryResult,
      errors: [400, 500],
    }),
  },
  "/api/reports/category-stats": {
    get: op({
      id: "getCategoryStats",
      summary: "Per-category spending stats with rollups and category metadata",
      tags: ["Reports"],
      query: CategoryStatsSchema,
      response: z.array(CategorySpendingItem),
      errors: [400, 500],
    }),
  },
  "/api/reports/budget-stats": {
    get: op({
      id: "getBudgetStats",
      summary: "Per-category spending stats augmented with budget amounts for a month",
      tags: ["Reports"],
      query: BudgetStatsSchema,
      response: z.array(BudgetStatsItem),
      errors: [400, 500],
    }),
  },
  "/api/reports/trends": {
    get: op({
      id: "trends",
      summary: "Month-over-month spending trends",
      tags: ["Reports"],
      query: TrendsSchema,
      response: z.array(Trend),
      errors: [400, 500],
    }),
  },
  "/api/reports/top-merchants": {
    get: op({
      id: "topMerchants",
      summary: "Top merchants by spend",
      tags: ["Reports"],
      query: TopMerchantsSchema,
      response: z.array(Merchant),
      errors: [400, 500],
    }),
  },
};
