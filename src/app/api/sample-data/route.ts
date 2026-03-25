import { NextResponse } from "next/server";
import { clearSampleData, hasSampleData } from "@/lib/services/sample-data";
import { errorResponse, handleServiceError } from "@/lib/api/helpers";
import { apiLogger } from "@/lib/logger";

/** Check whether the app is currently populated with sample data. */
export function GET(): NextResponse {
  try {
    return NextResponse.json({ hasSampleData: hasSampleData() });
  } catch (err) {
    return handleServiceError(err);
  }
}

/** Clear all sample data — deletes the DB so a fresh one is created on next access. */
export function DELETE(): NextResponse {
  try {
    clearSampleData();
    apiLogger.info("Sample data cleared via API");
    return NextResponse.json({ cleared: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("not flagged as sample data")) {
      return errorResponse(message, "VALIDATION_ERROR", 409);
    }
    return handleServiceError(err);
  }
}
