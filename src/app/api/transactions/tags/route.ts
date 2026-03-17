import { NextResponse } from "next/server";
import { getTransactionService } from "@/lib/api/services";
import { errorResponse } from "@/lib/api/helpers";

export async function GET(): Promise<NextResponse> {
  try {
    const tags = getTransactionService().listTags();
    return NextResponse.json(tags);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message, "INTERNAL_ERROR", 500);
  }
}
