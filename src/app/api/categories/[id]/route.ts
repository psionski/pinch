import { NextResponse } from "next/server";
import { getCategoryService } from "@/lib/api/services";
import { parseBody, isErrorResponse, errorResponse, parseId } from "@/lib/api/helpers";
import { UpdateCategorySchema } from "@/lib/validators/categories";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: RouteContext): Promise<NextResponse> {
  const id = parseId(await ctx.params);
  if (isErrorResponse(id)) return id;

  const category = getCategoryService().getById(id);
  if (!category) return errorResponse("Category not found", "NOT_FOUND", 404);
  return NextResponse.json(category);
}

export async function PATCH(req: Request, ctx: RouteContext): Promise<NextResponse> {
  const id = parseId(await ctx.params);
  if (isErrorResponse(id)) return id;

  const input = await parseBody(req, UpdateCategorySchema);
  if (isErrorResponse(input)) return input;

  try {
    const category = getCategoryService().update(id, input);
    if (!category) return errorResponse("Category not found", "NOT_FOUND", 404);
    return NextResponse.json(category);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (message.includes("UNIQUE")) {
      return errorResponse("Category name already exists", "CONFLICT", 409);
    }
    return errorResponse(message, "INTERNAL_ERROR", 500);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext): Promise<NextResponse> {
  const id = parseId(await ctx.params);
  if (isErrorResponse(id)) return id;

  const deleted = getCategoryService().delete(id);
  if (!deleted) return errorResponse("Category not found", "NOT_FOUND", 404);
  return NextResponse.json({ success: true });
}
