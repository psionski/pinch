import { NextResponse } from "next/server";
import { getBudgetService } from "@/lib/api/services";
import { parseBody, isErrorResponse, errorResponse } from "@/lib/api/helpers";
import { CopyBudgetsSchema } from "@/lib/validators/budgets";

export async function POST(req: Request): Promise<NextResponse> {
  const input = await parseBody(req, CopyBudgetsSchema);
  if (isErrorResponse(input)) return input;

  try {
    const copied = getBudgetService().copyFromPreviousMonth(input);
    return NextResponse.json({ copied });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message, "INTERNAL_ERROR", 500);
  }
}
