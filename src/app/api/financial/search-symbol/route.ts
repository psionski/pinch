import { NextResponse } from "next/server";
import { getFinancialDataService } from "@/lib/api/services";
import { parseSearchParams, isErrorResponse } from "@/lib/api/helpers";
import { z } from "zod";

const SearchSymbolQuerySchema = z.object({
  query: z.string().min(1),
});

export async function GET(req: Request): Promise<NextResponse> {
  const input = parseSearchParams(req.url, SearchSymbolQuerySchema);
  if (isErrorResponse(input)) return input;

  const results = await getFinancialDataService().searchSymbol(input.query);
  return NextResponse.json(results);
}
