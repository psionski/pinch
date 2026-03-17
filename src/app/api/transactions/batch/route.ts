import { NextResponse } from "next/server";
import { getTransactionService } from "@/lib/api/services";
import { parseBody, isErrorResponse, errorResponse } from "@/lib/api/helpers";
import { CreateTransactionsBatchSchema } from "@/lib/validators/transactions";

export async function POST(req: Request): Promise<NextResponse> {
  const input = await parseBody(req, CreateTransactionsBatchSchema);
  if (isErrorResponse(input)) return input;

  try {
    const results = getTransactionService().createBatch(input);
    return NextResponse.json(results, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (message.includes("FOREIGN KEY")) {
      return errorResponse("Referenced category or receipt not found", "NOT_FOUND", 404);
    }
    return errorResponse(message, "INTERNAL_ERROR", 500);
  }
}
