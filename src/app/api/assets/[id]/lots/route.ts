import { NextResponse } from "next/server";
import { getAssetLotService } from "@/lib/api/services";
import { parseId, isErrorResponse } from "@/lib/api/helpers";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: RouteContext): Promise<NextResponse> {
  const id = parseId(await ctx.params);
  if (isErrorResponse(id)) return id;

  const lots = getAssetLotService().listLots(id);
  return NextResponse.json(lots);
}
