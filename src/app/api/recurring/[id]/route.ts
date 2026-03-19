import { NextResponse } from "next/server";
import { getRecurringService } from "@/lib/api/services";
import { parseBody, isErrorResponse, errorResponse, parseId } from "@/lib/api/helpers";
import { UpdateRecurringSchema } from "@/lib/validators/recurring";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: RouteContext): Promise<NextResponse> {
  const id = parseId(await ctx.params);
  if (isErrorResponse(id)) return id;

  const recurring = getRecurringService().getById(id);
  if (!recurring) return errorResponse("Recurring template not found", "NOT_FOUND", 404);
  return NextResponse.json(recurring);
}

export async function PATCH(req: Request, ctx: RouteContext): Promise<NextResponse> {
  const id = parseId(await ctx.params);
  if (isErrorResponse(id)) return id;

  const input = await parseBody(req, UpdateRecurringSchema);
  if (isErrorResponse(input)) return input;

  const recurring = getRecurringService().update(id, input);
  if (!recurring) return errorResponse("Recurring template not found", "NOT_FOUND", 404);
  return NextResponse.json(recurring);
}

export async function DELETE(_req: Request, ctx: RouteContext): Promise<NextResponse> {
  const id = parseId(await ctx.params);
  if (isErrorResponse(id)) return id;

  const deleted = getRecurringService().delete(id);
  if (!deleted) return errorResponse("Recurring template not found", "NOT_FOUND", 404);
  return NextResponse.json({ success: true });
}
