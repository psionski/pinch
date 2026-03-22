import { NextResponse } from "next/server";
import { getFinancialDataService } from "@/lib/api/services";
import { parseSearchParams, isErrorResponse } from "@/lib/api/helpers";
import { GetPriceSchema } from "@/lib/validators/financial";

export async function GET(req: Request): Promise<NextResponse> {
  const input = parseSearchParams(req.url, GetPriceSchema);
  if (isErrorResponse(input)) return input;

  const result = await getFinancialDataService().getPrice(input.symbol, input.currency, input.date);
  if (!result) return NextResponse.json({ error: "No price available" }, { status: 404 });
  return NextResponse.json(result);
}
