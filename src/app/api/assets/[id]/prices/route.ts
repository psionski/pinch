import { NextResponse } from "next/server";
import { getAssetPriceService } from "@/lib/api/services";
import { parseBody, parseId, isErrorResponse, handleServiceError } from "@/lib/api/helpers";
import { RecordPriceSchema } from "@/lib/validators/assets";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, ctx: RouteContext): Promise<NextResponse> {
  const id = parseId(await ctx.params);
  if (isErrorResponse(id)) return id;

  const input = await parseBody(req, RecordPriceSchema);
  if (isErrorResponse(input)) return input;

  try {
    const price = getAssetPriceService().record(id, input);
    return NextResponse.json(price, { status: 201 });
  } catch (err) {
    return handleServiceError(err);
  }
}
