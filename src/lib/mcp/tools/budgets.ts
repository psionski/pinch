import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  SetBudgetSchema,
  GetBudgetStatusSchema,
  CopyBudgetsSchema,
  DeleteBudgetSchema,
} from "@/lib/validators/budgets";
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

  server.registerTool(
    "copy_budgets",
    {
      description:
        "Copy all budgets from one month to another. " +
        "Existing budgets in the target month are updated with the source amounts.",
      inputSchema: CopyBudgetsSchema,
    },
    (input) => ok({ copied: getBudgetService().copyFromPreviousMonth(input) })
  );

  server.registerTool(
    "delete_budget",
    {
      description: "Delete a budget for a specific category and month.",
      inputSchema: DeleteBudgetSchema,
    },
    (input) => ok({ deleted: getBudgetService().delete(input.categoryId, input.month) })
  );
}
