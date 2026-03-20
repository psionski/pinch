import { NextResponse } from "next/server";
import { getPortfolioReportService } from "@/lib/api/services";
import { parseId, parseSearchParams, isErrorResponse, errorResponse } from "@/lib/api/helpers";
import { AssetHistoryQuerySchema } from "@/lib/validators/portfolio-reports";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, ctx: RouteContext): Promise<NextResponse> {
  const id = parseId(await ctx.params);
  if (isErrorResponse(id)) return id;

  const input = parseSearchParams(req.url, AssetHistoryQuerySchema);
  if (isErrorResponse(input)) return input;

  const data = getPortfolioReportService().getAssetHistory(id, input.window);
  if (!data) return errorResponse("Asset not found", "NOT_FOUND", 404);
  return NextResponse.json(data);
}
