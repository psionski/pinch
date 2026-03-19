import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  SetBudgetSchema,
  GetBudgetStatusSchema,
  ResetBudgetsSchema,
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
        "If the month has no budgets yet, inherited budgets from the most recent prior month are " +
        "automatically copied first (copy-on-write), then this budget is set. " +
        "Re-setting a previously deleted budget un-deletes it.",
      inputSchema: SetBudgetSchema,
    },
    (input) => ok(getBudgetService().set(input))
  );

  server.registerTool(
    "get_budget_status",
    {
      description:
        "Current spend vs budget for all budgeted categories in a given month. " +
        "Budgets are inherited from the most recent prior month if none exist for the requested month — " +
        "'inheritedFrom' in the response indicates the source month (null means the month has its own budgets). " +
        "Only returns categories that have an effective budget — categories without budgets are excluded. " +
        "Returns amounts, percentages, and over/under status. Uses child category rollup for spend.",
      inputSchema: GetBudgetStatusSchema,
    },
    (input) => ok(getBudgetService().getForMonth(input))
  );

  server.registerTool(
    "reset_budgets",
    {
      description:
        "Reset a month's budgets back to inherited state by hard-deleting all explicit budget rows for that month. " +
        "After a reset the month will show budgets inherited from the most recent prior month. " +
        "Use this to undo manual budget edits for a specific month.",
      inputSchema: ResetBudgetsSchema,
    },
    (input) => {
      getBudgetService().resetToInherited(input.month);
      return ok({ success: true });
    }
  );

  server.registerTool(
    "delete_budget",
    {
      description:
        "Remove a budget for a specific category and month. " +
        "If the month has no own budget rows yet, inherited budgets are copied first, then this " +
        "category's budget is soft-deleted so future months also exclude it via inheritance.",
      inputSchema: DeleteBudgetSchema,
    },
    (input) => ok({ deleted: getBudgetService().delete(input.categoryId, input.month) })
  );
}
