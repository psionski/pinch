import { NextResponse } from "next/server";
import { getBudgetService } from "@/lib/api/services";
import { parseSearchParams, isErrorResponse, errorResponse } from "@/lib/api/helpers";
import { BudgetHistorySchema, type BudgetHistoryPoint } from "@/lib/validators/budgets";

export async function GET(req: Request): Promise<NextResponse> {
  const input = parseSearchParams(req.url, BudgetHistorySchema);
  if (isErrorResponse(input)) return input;

  try {
    const budgetService = getBudgetService();
    const now = new Date();
    const points: BudgetHistoryPoint[] = [];

    for (let i = input.months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const { items: status } = budgetService.getForMonth({ month });

      const totalBudget = status.reduce((sum, b) => sum + b.budgetAmount, 0);
      const totalSpent = status.reduce((sum, b) => sum + b.spentAmount, 0);
      const percentUsed =
        totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 10000) / 100 : 0;

      points.push({ month, totalBudget, totalSpent, percentUsed });
    }

    return NextResponse.json(points);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message, "INTERNAL_ERROR", 500);
  }
}
