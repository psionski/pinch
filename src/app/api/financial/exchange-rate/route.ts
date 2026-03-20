import { NextResponse } from "next/server";
import { getFinancialDataService } from "@/lib/api/services";
import { parseSearchParams, isErrorResponse, errorResponse } from "@/lib/api/helpers";
import { GetExchangeRateSchema } from "@/lib/validators/financial";

export async function GET(req: Request): Promise<NextResponse> {
  const input = parseSearchParams(req.url, GetExchangeRateSchema);
  if (isErrorResponse(input)) return input;

  const result = await getFinancialDataService().getExchangeRate(
    input.base,
    input.quote,
    input.date
  );
  if (!result) {
    return errorResponse(
      `No exchange rate available for ${input.base}/${input.quote}`,
      "NOT_FOUND",
      404
    );
  }

  return NextResponse.json(result);
}
