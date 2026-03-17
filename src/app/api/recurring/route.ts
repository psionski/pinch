import { NextResponse } from "next/server";
import { getRecurringService } from "@/lib/api/services";
import { parseBody, isErrorResponse, errorResponse } from "@/lib/api/helpers";
import { CreateRecurringSchema } from "@/lib/validators/recurring";

export async function POST(req: Request): Promise<NextResponse> {
  const input = await parseBody(req, CreateRecurringSchema);
  if (isErrorResponse(input)) return input;

  try {
    const recurring = getRecurringService().create(input);
    return NextResponse.json(recurring, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (message.includes("FOREIGN KEY")) {
      return errorResponse("Category not found", "NOT_FOUND", 404);
    }
    return errorResponse(message, "INTERNAL_ERROR", 500);
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    const result = getRecurringService().list();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message, "INTERNAL_ERROR", 500);
  }
}
