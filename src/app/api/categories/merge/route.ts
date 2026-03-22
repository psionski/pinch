import { NextResponse } from "next/server";
import { getCategoryService } from "@/lib/api/services";
import { parseBody, isErrorResponse, errorResponse } from "@/lib/api/helpers";
import { MergeCategoriesSchema } from "@/lib/validators/categories";

export async function POST(req: Request): Promise<NextResponse> {
  const input = await parseBody(req, MergeCategoriesSchema);
  if (isErrorResponse(input)) return input;

  try {
    const result = getCategoryService().merge(input);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message, "INTERNAL_ERROR", 500);
  }
}
