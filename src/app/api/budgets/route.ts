import { NextResponse } from "next/server";
import { getBudgetService } from "@/lib/api/services";
import {
  parseBody,
  parseSearchParams,
  isErrorResponse,
  errorResponse,
  handleServiceError,
} from "@/lib/api/helpers";
import {
  SetBudgetSchema,
  GetBudgetStatusSchema,
  DeleteBudgetSchema,
} from "@/lib/validators/budgets";

export async function POST(req: Request): Promise<NextResponse> {
  const input = await parseBody(req, SetBudgetSchema);
  if (isErrorResponse(input)) return input;

  try {
    const budget = getBudgetService().set(input);
    return NextResponse.json(budget, { status: 201 });
  } catch (err) {
    return handleServiceError(err, "Category not found");
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  const input = parseSearchParams(req.url, GetBudgetStatusSchema);
  if (isErrorResponse(input)) return input;

  try {
    const result = getBudgetService().getForMonth(input);
    return NextResponse.json(result);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function DELETE(req: Request): Promise<NextResponse> {
  const input = parseSearchParams(req.url, DeleteBudgetSchema);
  if (isErrorResponse(input)) return input;

  try {
    const deleted = getBudgetService().delete(input.categoryId, input.month);
    if (!deleted) return errorResponse("Budget not found", "NOT_FOUND", 404);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleServiceError(err);
  }
}
