import { NextResponse } from "next/server";
import { getPortfolioReportService } from "@/lib/api/services";
import { parseSearchParams, isErrorResponse } from "@/lib/api/helpers";
import { NetWorthQuerySchema } from "@/lib/validators/portfolio-reports";

export function GET(req: Request): NextResponse {
  const input = parseSearchParams(req.url, NetWorthQuerySchema);
  if (isErrorResponse(input)) return input;

  const data = getPortfolioReportService().getNetWorthTimeSeries(input.window, input.interval);
  return NextResponse.json(data);
}
