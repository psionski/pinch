import { NextResponse } from "next/server";
import { getPortfolioReportService } from "@/lib/api/services";
import { parseSearchParams, isErrorResponse } from "@/lib/api/helpers";
import { RealizedPnlQuerySchema } from "@/lib/validators/portfolio-reports";

export function GET(req: Request): NextResponse {
  const input = parseSearchParams(req.url, RealizedPnlQuerySchema);
  if (isErrorResponse(input)) return input;

  const data = getPortfolioReportService().getRealizedPnL(input.from, input.to);
  return NextResponse.json(data);
}
