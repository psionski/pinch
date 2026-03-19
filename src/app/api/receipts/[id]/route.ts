import { NextResponse } from "next/server";
import { errorResponse, parseId, isErrorResponse } from "@/lib/api/helpers";
import { getReceiptService } from "@/lib/api/services";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: RouteContext): Promise<NextResponse> {
  const id = parseId(await ctx.params);
  if (isErrorResponse(id)) return id;

  const receipt = getReceiptService().getById(id);
  if (!receipt) return errorResponse("Receipt not found", "NOT_FOUND", 404);

  return NextResponse.json(receipt);
}

export async function DELETE(_req: Request, ctx: RouteContext): Promise<NextResponse> {
  const id = parseId(await ctx.params);
  if (isErrorResponse(id)) return id;

  const deleted = getReceiptService().delete(id);
  if (!deleted) return errorResponse("Receipt not found", "NOT_FOUND", 404);

  return NextResponse.json({ success: true });
}
