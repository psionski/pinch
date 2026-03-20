import { NextResponse } from "next/server";
import { getBudgetService } from "@/lib/api/services";
import { parseSearchParams, isErrorResponse, handleServiceError } from "@/lib/api/helpers";
import { BudgetHistorySchema } from "@/lib/validators/budgets";

export async function GET(req: Request): Promise<NextResponse> {
  const input = parseSearchParams(req.url, BudgetHistorySchema);
  if (isErrorResponse(input)) return input;

  try {
    const points = getBudgetService().getHistory(input.months);
    return NextResponse.json(points);
  } catch (err) {
    return handleServiceError(err);
  }
}
