import { NextResponse } from "next/server";
import { getFinancialDataService } from "@/lib/api/services";
import { parseSearchParams, isErrorResponse, errorResponse } from "@/lib/api/helpers";
import { GetMarketPriceSchema } from "@/lib/validators/financial";

export async function GET(req: Request): Promise<NextResponse> {
  const input = parseSearchParams(req.url, GetMarketPriceSchema);
  if (isErrorResponse(input)) return input;

  const result = await getFinancialDataService().getMarketPrice(
    input.symbol,
    input.currency,
    input.date
  );
  if (!result) {
    return errorResponse(`No price available for ${input.symbol}`, "NOT_FOUND", 404);
  }

  return NextResponse.json(result);
}
