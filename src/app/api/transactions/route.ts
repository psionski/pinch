import { NextResponse } from "next/server";
import { getTransactionService } from "@/lib/api/services";
import { parseBody, parseSearchParams, isErrorResponse, errorResponse } from "@/lib/api/helpers";
import {
  CreateTransactionSchema,
  UpdateTransactionsBatchSchema,
  ListTransactionsSchema,
} from "@/lib/validators/transactions";

export async function POST(req: Request): Promise<NextResponse> {
  const input = await parseBody(req, CreateTransactionSchema);
  if (isErrorResponse(input)) return input;

  try {
    const tx = getTransactionService().create(input);
    return NextResponse.json(tx, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (message.includes("FOREIGN KEY")) {
      return errorResponse("Referenced category or receipt not found", "NOT_FOUND", 404);
    }
    return errorResponse(message, "INTERNAL_ERROR", 500);
  }
}

export async function PATCH(req: Request): Promise<NextResponse> {
  const input = await parseBody(req, UpdateTransactionsBatchSchema);
  if (isErrorResponse(input)) return input;

  try {
    const results = getTransactionService().updateBatch(input);
    return NextResponse.json(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (message.includes("FOREIGN KEY")) {
      return errorResponse("Referenced category not found", "NOT_FOUND", 404);
    }
    return errorResponse(message, "INTERNAL_ERROR", 500);
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  const input = parseSearchParams(req.url, ListTransactionsSchema);
  if (isErrorResponse(input)) return input;

  try {
    const result = getTransactionService().list(input);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message, "INTERNAL_ERROR", 500);
  }
}
