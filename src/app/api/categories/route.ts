import { NextResponse } from "next/server";
import { getCategoryService } from "@/lib/api/services";
import { parseBody, isErrorResponse, errorResponse } from "@/lib/api/helpers";
import { CreateCategorySchema } from "@/lib/validators/categories";

export async function POST(req: Request): Promise<NextResponse> {
  const input = await parseBody(req, CreateCategorySchema);
  if (isErrorResponse(input)) return input;

  try {
    const category = getCategoryService().create(input);
    return NextResponse.json(category, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (message.includes("UNIQUE")) {
      return errorResponse("Category name already exists", "CONFLICT", 409);
    }
    return errorResponse(message, "INTERNAL_ERROR", 500);
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    const categories = getCategoryService().getAll();
    return NextResponse.json(categories);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message, "INTERNAL_ERROR", 500);
  }
}
