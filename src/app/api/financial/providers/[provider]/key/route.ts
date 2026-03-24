import { NextResponse } from "next/server";
import { getFinancialDataService } from "@/lib/api/services";
import { parseBody, isErrorResponse, errorResponse } from "@/lib/api/helpers";
import { SetApiKeyBodySchema, ProviderParamSchema } from "@/lib/validators/financial";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
): Promise<NextResponse> {
  const { provider: rawProvider } = await params;

  const providerParsed = ProviderParamSchema.safeParse({ provider: rawProvider });
  if (!providerParsed.success) {
    return errorResponse(`Unknown provider: ${rawProvider}`, "VALIDATION_ERROR", 400);
  }

  const body = await parseBody(req, SetApiKeyBodySchema);
  if (isErrorResponse(body)) return body;

  getFinancialDataService().setApiKey(providerParsed.data.provider, body.key);
  return NextResponse.json({ success: true, provider: providerParsed.data.provider });
}
