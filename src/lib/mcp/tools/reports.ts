import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  SpendingSummarySchema,
  CategoryBreakdownSchema,
  TrendsSchema,
  TopMerchantsSchema,
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
    "category_breakdown",
    {
      description:
        "Per-category amounts and percentages for a period — suitable for pie/donut chart data.",
      inputSchema: CategoryBreakdownSchema,
    },
    (input) => ok(getReportService().categoryBreakdown(input))
  );

  server.registerTool(
    "trends",
    {
      description:
        "Month-over-month time series. Configurable look-back window (months). " +
        "Optionally filter by a single category.",
      inputSchema: TrendsSchema,
    },
    (input) => ok(getReportService().trends(input))
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
