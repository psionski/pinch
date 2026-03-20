import { NextResponse } from "next/server";
import { getAssetService } from "@/lib/api/services";
import {
  parseBody,
  parseId,
  isErrorResponse,
  errorResponse,
  handleServiceError,
} from "@/lib/api/helpers";
import { UpdateAssetSchema } from "@/lib/validators/assets";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: RouteContext): Promise<NextResponse> {
  const id = parseId(await ctx.params);
  if (isErrorResponse(id)) return id;

  const asset = getAssetService().getById(id);
  if (!asset) return errorResponse("Asset not found", "NOT_FOUND", 404);
  return NextResponse.json(asset);
}

export async function PATCH(req: Request, ctx: RouteContext): Promise<NextResponse> {
  const id = parseId(await ctx.params);
  if (isErrorResponse(id)) return id;

  const input = await parseBody(req, UpdateAssetSchema);
  if (isErrorResponse(input)) return input;

  try {
    const asset = getAssetService().update(id, input);
    if (!asset) return errorResponse("Asset not found", "NOT_FOUND", 404);
    return NextResponse.json(asset);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext): Promise<NextResponse> {
  const id = parseId(await ctx.params);
  if (isErrorResponse(id)) return id;

  const deleted = getAssetService().delete(id);
  if (!deleted) return errorResponse("Asset not found", "NOT_FOUND", 404);
  return new NextResponse(null, { status: 204 });
}
