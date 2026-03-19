import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  SpendingSummarySchema,
  CategoryStatsSchema,
  BudgetStatsSchema,
  TrendsSchema,
  TopMerchantsSchema,
  NetBalanceSchema,
} from "@/lib/validators/reports";
import { getReportService } from "@/lib/api/services";

function ok(data: unknown): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

export function registerReportTools(server: McpServer): void {
  server.registerTool(
    "spending_summary",
    {
      description:
        "Total spend for a period, grouped by category, month, or merchant. " +
        "Optionally compare against a second period by supplying compareDateFrom and compareDateTo.",
      inputSchema: SpendingSummarySchema,
    },
    (input) => ok(getReportService().spendingSummary(input))
  );

  server.registerTool(
    "category_stats",
    {
      description:
        "Per-category spending stats. Returns amounts, percentages, hierarchy rollups, " +
        "and category color/icon. Provide 'month' (YYYY-MM) or " +
        "'dateFrom'+'dateTo' (YYYY-MM-DD). Set includeZeroSpend=false to omit categories " +
        "with no transactions. Use budget_stats for budget amounts.",
      inputSchema: CategoryStatsSchema,
    },
    (input) => ok(getReportService().getCategoryStats(input))
  );

  server.registerTool(
    "budget_stats",
    {
      description:
        "Per-category spending stats augmented with budget amounts for a given month. " +
        "Returns everything category_stats returns (amounts, percentages, hierarchy rollups, " +
        "color/icon, parentId), plus budgetAmount per category (null if no budget is set). " +
        "Requires 'month' (YYYY-MM).",
      inputSchema: BudgetStatsSchema,
    },
    (input) => ok(getReportService().getBudgetStats(input))
  );

  server.registerTool(
    "trends",
    {
      description:
        "Monthly totals time series for the last N months (default 6, max 24). " +
        "Returns one data point per month with total amount and transaction count. " +
        "Optionally filter by a single category.",
      inputSchema: TrendsSchema,
    },
    (input) => ok(getReportService().trends(input))
  );

  server.registerTool(
    "get_net_balance",
    {
      description:
        "Returns total income minus total expenses (net balance) in cents. " +
        "Optionally filter by date range. Without dates, returns the all-time balance.",
      inputSchema: NetBalanceSchema,
    },
    (input) => ok(getReportService().netBalance(input))
  );

  server.registerTool(
    "top_merchants",
    {
      description:
        "Highest-spend merchants for a period, with transaction counts and average amounts.",
      inputSchema: TopMerchantsSchema,
    },
    (input) => ok(getReportService().topMerchants(input))
  );
}
