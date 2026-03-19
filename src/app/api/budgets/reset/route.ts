import { NextResponse } from "next/server";
import { getBudgetService } from "@/lib/api/services";
import { parseBody, isErrorResponse, errorResponse } from "@/lib/api/helpers";
import { ResetBudgetsSchema } from "@/lib/validators/budgets";

export async function POST(req: Request): Promise<NextResponse> {
  const input = await parseBody(req, ResetBudgetsSchema);
  if (isErrorResponse(input)) return input;

  try {
    getBudgetService().resetToInherited(input.month);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message, "INTERNAL_ERROR", 500);
  }
}
