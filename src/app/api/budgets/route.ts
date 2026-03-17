import { NextResponse } from "next/server";
import { getBudgetService } from "@/lib/api/services";
import { parseBody, parseSearchParams, isErrorResponse, errorResponse } from "@/lib/api/helpers";
import { SetBudgetSchema, GetBudgetStatusSchema } from "@/lib/validators/budgets";

export async function POST(req: Request): Promise<NextResponse> {
  const input = await parseBody(req, SetBudgetSchema);
  if (isErrorResponse(input)) return input;

  try {
    const budget = getBudgetService().set(input);
    return NextResponse.json(budget, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (message.includes("FOREIGN KEY")) {
      return errorResponse("Category not found", "NOT_FOUND", 404);
    }
    return errorResponse(message, "INTERNAL_ERROR", 500);
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  const input = parseSearchParams(req.url, GetBudgetStatusSchema);
  if (isErrorResponse(input)) return input;

  try {
    const result = getBudgetService().getForMonth(input);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message, "INTERNAL_ERROR", 500);
  }
}
