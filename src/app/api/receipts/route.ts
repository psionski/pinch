import { NextResponse } from "next/server";
import { getReceiptService } from "@/lib/api/services";
import { parseBody, parseSearchParams, isErrorResponse, errorResponse } from "@/lib/api/helpers";
import { ListReceiptsSchema, DeleteReceiptsBatchSchema } from "@/lib/validators/receipts";

export async function GET(req: Request): Promise<NextResponse> {
  const input = parseSearchParams(req.url, ListReceiptsSchema);
  if (isErrorResponse(input)) return input;

  try {
    const result = getReceiptService().list(input);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message, "INTERNAL_ERROR", 500);
  }
}

export async function DELETE(req: Request): Promise<NextResponse> {
  const input = await parseBody(req, DeleteReceiptsBatchSchema);
  if (isErrorResponse(input)) return input;

  try {
    const deleted = getReceiptService().batchDelete(input.ids);
    return NextResponse.json({ deleted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return errorResponse(message, "INTERNAL_ERROR", 500);
  }
}
