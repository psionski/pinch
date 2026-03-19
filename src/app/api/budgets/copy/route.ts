import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api/helpers";

// This endpoint was replaced by POST /api/budgets/reset
export async function POST(): Promise<NextResponse> {
  return errorResponse("Use POST /api/budgets/reset instead", "NOT_FOUND", 410);
}
