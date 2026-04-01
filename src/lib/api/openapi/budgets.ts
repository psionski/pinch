import { z } from "zod";
import {
  SetBudgetSchema,
  GetBudgetStatusSchema,
  DeleteBudgetSchema,
  ResetBudgetsSchema,
  BudgetHistorySchema,
  BudgetResponseSchema,
} from "@/lib/validators/budgets";
import { BudgetStatusItemSchema } from "@/lib/validators/reports";
import { op, SuccessSchema } from "./helpers";

const Budget = BudgetResponseSchema.meta({ id: "Budget" });
const BudgetStatus = BudgetStatusItemSchema.meta({ id: "BudgetStatusItem" });

export const budgetPaths = {
  "/api/budgets": {
    post: op({
      id: "setBudget",
      summary: "Set or update a budget for a category and month",
      tags: ["Budgets"],
      body: SetBudgetSchema,
      response: Budget,
      status: 201,
      errors: [400, 404, 500],
    }),
    get: op({
      id: "getBudgetStatus",
      summary: "Get budget status for all categories in a month",
      tags: ["Budgets"],
      query: GetBudgetStatusSchema,
      response: z.array(BudgetStatus),
      errors: [400, 500],
    }),
    delete: op({
      id: "deleteBudget",
      summary: "Delete a budget for a category and month",
      tags: ["Budgets"],
      query: DeleteBudgetSchema,
      response: SuccessSchema,
      errors: [400, 404, 500],
    }),
  },
  "/api/budgets/reset": {
    post: op({
      id: "resetBudgets",
      summary: "Reset a month's budgets to inherited state by hard-deleting all explicit rows",
      tags: ["Budgets"],
      body: ResetBudgetsSchema,
      response: z.object({ success: z.boolean() }),
      errors: [400, 500],
    }),
  },
  "/api/budgets/history": {
    get: op({
      id: "budgetHistory",
      summary: "Get historical budget vs actual totals across recent months",
      tags: ["Budgets"],
      query: BudgetHistorySchema,
      response: z.array(
        z.object({
          month: z.string(),
          totalBudget: z.number().int(),
          totalSpent: z.number().int(),
          percentUsed: z.number(),
        })
      ),
      errors: [400, 500],
    }),
  },
};
