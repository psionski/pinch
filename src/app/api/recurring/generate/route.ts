import { NextResponse } from "next/server";
import { getRecurringService } from "@/lib/api/services";
import { parseBody, isErrorResponse, errorResponse } from "@/lib/api/helpers";
import { GenerateRecurringSchema } from "@/lib/validators/recurring";

export async function POST(req: Request): Promise<NextResponse> {
  const input = await parseBody(req, GenerateRecurringSchema);
  if (isErrorResponse(input)) return input;

  try {
    const created = getRecurringService().generatePending(input);
    return NextResponse.json({ created });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message, "INTERNAL_ERROR", 500);
  }
}
