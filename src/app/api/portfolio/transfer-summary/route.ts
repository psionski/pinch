import { NextResponse } from "next/server";
import { z } from "zod";
import { getPortfolioReportService } from "@/lib/api/services";
import { parseSearchParams, isErrorResponse } from "@/lib/api/helpers";

const TransferSummaryQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

export function GET(req: Request): NextResponse {
  const input = parseSearchParams(req.url, TransferSummaryQuerySchema);
  if (isErrorResponse(input)) return input;

  const data = getPortfolioReportService().getTransferSummary(input.month);
  return NextResponse.json(data);
}
