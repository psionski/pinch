import { NextResponse } from "next/server";
import { getCategoryService } from "@/lib/api/services";
import { parseBody, isErrorResponse, errorResponse } from "@/lib/api/helpers";
import { RecategorizeSchema } from "@/lib/validators/categories";

export async function POST(req: Request): Promise<NextResponse> {
  const input = await parseBody(req, RecategorizeSchema);
  if (isErrorResponse(input)) return input;

  try {
    const count = getCategoryService().recategorize(input);
    return NextResponse.json(
      input.dryRun ? { wouldUpdate: count, dryRun: true } : { updated: count }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message, "INTERNAL_ERROR", 500);
  }
}
