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
        "Set applyToFutureMonths to true to also update all existing budget rows for the same " +
        "category in later months — does not create new rows for months without a budget yet.",
      inputSchema: SetBudgetSchema,
    },
    (input) => ok(getBudgetService().set(input))
  );

  server.registerTool(
    "get_budget_status",
    {
      description:
        "Current spend vs budget for all budgeted categories in a given month. " +
        "Only returns categories that have a budget set — categories without budgets are excluded. " +
        "Returns amounts, percentages, and over/under status. Uses child category rollup for spend.",
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
