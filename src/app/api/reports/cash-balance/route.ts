import { NextResponse } from "next/server";
import { getReportService } from "@/lib/api/services";
import { errorResponse } from "@/lib/api/helpers";

export async function GET(): Promise<NextResponse> {
  try {
    const result = getReportService().cashBalance();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message, "INTERNAL_ERROR", 500);
  }
}
