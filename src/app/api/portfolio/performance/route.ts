import { NextResponse } from "next/server";
import { getPortfolioReportService } from "@/lib/api/services";
import { parseSearchParams, isErrorResponse } from "@/lib/api/helpers";
import { AssetPerformanceQuerySchema } from "@/lib/validators/portfolio-reports";

export function GET(req: Request): NextResponse {
  const input = parseSearchParams(req.url, AssetPerformanceQuerySchema);
  if (isErrorResponse(input)) return input;

  const data = getPortfolioReportService().getAssetPerformance(input.from, input.to);
  return NextResponse.json(data);
}
