import { NextResponse } from "next/server";
import { getCategoryService } from "@/lib/api/services";
import { errorResponse } from "@/lib/api/helpers";

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month");

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return errorResponse(
        "Query parameter 'month' is required (format: YYYY-MM)",
        "VALIDATION_ERROR",
        400
      );
    }

    const stats = getCategoryService().getStats(month);
    return NextResponse.json(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message, "INTERNAL_ERROR", 500);
  }
}
