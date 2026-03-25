import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  SpendingSummarySchema,
  CategoryStatsSchema,
  TrendsSchema,
  TopMerchantsSchema,
  NetBalanceSchema,
} from "@/lib/validators/reports";
import { getReportService } from "@/lib/api/services";
import { ok } from "@/lib/mcp/response";

export function registerReportTools(server: McpServer): void {
  server.registerTool(
    "get_spending_summary",
    {
      description:
        "Total spend for a period, grouped by category, month, or merchant. " +
        "Best for comparing periods or viewing spending by merchant. " +
        "For per-category breakdowns with hierarchy rollups and percentages, use get_category_stats instead. " +
        "Optionally compare against a second period by supplying compareDateFrom and compareDateTo.",
      inputSchema: SpendingSummarySchema,
    },
    (input) => ok(getReportService().spendingSummary(input))
  );

  server.registerTool(
    "get_category_stats",
    {
      description:
        "Per-category spending stats with hierarchy rollups, percentages, and category color/icon. " +
        "Best for detailed per-category breakdowns. " +
        "For flexible grouping (by merchant/month) or period comparisons, use get_spending_summary instead. " +
        "Use get_budget_status for budget tracking.",
      inputSchema: CategoryStatsSchema,
    },
    (input) => ok(getReportService().getCategoryStats(input))
  );

  server.registerTool(
    "get_trends",
    {
      description:
        "Monthly totals time series. Returns one data point per month with total amount and transaction count.",
      inputSchema: TrendsSchema,
    },
    (input) => ok(getReportService().trends(input))
  );

  server.registerTool(
    "get_net_balance",
    {
      description:
        "Total income minus total expenses (net balance). Without dates, returns the all-time balance.",
      inputSchema: NetBalanceSchema,
    },
    (input) => ok(getReportService().netBalance(input))
  );

  server.registerTool(
    "get_top_merchants",
    {
      description: "Highest-spend merchants with transaction counts and average amounts.",
      inputSchema: TopMerchantsSchema,
    },
    (input) => ok(getReportService().topMerchants(input))
  );
}
