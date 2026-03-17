import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SetBudgetSchema, GetBudgetStatusSchema } from "@/lib/validators/budgets";
import { getBudgetService } from "@/lib/api/services";

function ok(data: unknown): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

export function registerBudgetTools(server: McpServer): void {
  server.registerTool(
    "set_budget",
    {
      description:
        "Set or update a monthly budget for a category. " +
        "Set applyToFutureMonths to true to also update all existing budgets for later months.",
      inputSchema: SetBudgetSchema,
    },
    (input) => ok(getBudgetService().set(input))
  );

  server.registerTool(
    "get_budget_status",
    {
      description:
        "Current spend vs budget for all categories in a given month. " +
        "Returns amounts, percentages, and over/under status.",
      inputSchema: GetBudgetStatusSchema,
    },
    (input) => ok(getBudgetService().getForMonth(input))
  );
}
