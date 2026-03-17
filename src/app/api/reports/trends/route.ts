import { NextResponse } from "next/server";
import { getReportService } from "@/lib/api/services";
import { parseSearchParams, isErrorResponse, errorResponse } from "@/lib/api/helpers";
import { TrendsSchema } from "@/lib/validators/reports";

export async function GET(req: Request): Promise<NextResponse> {
  const input = parseSearchParams(req.url, TrendsSchema);
  if (isErrorResponse(input)) return input;

  try {
    const result = getReportService().trends(input);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message, "INTERNAL_ERROR", 500);
  }
}
