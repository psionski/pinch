import { NextResponse } from "next/server";
import { getAssetService, getFinancialDataService } from "@/lib/api/services";
import { parseBody, isErrorResponse, handleServiceError } from "@/lib/api/helpers";
import { CreateAssetSchema } from "@/lib/validators/assets";
import { getDb } from "@/lib/db";
import { triggerSymbolBackfill } from "@/lib/services/symbol-backfill";

export function GET(): NextResponse {
  const assets = getAssetService().list();
  return NextResponse.json(assets);
}

export async function POST(req: Request): Promise<NextResponse> {
  const input = await parseBody(req, CreateAssetSchema);
  if (isErrorResponse(input)) return input;

  try {
    const asset = getAssetService().create(input);
    if (asset.symbolMap) {
      triggerSymbolBackfill(getDb(), getFinancialDataService(), asset);
    }
    return NextResponse.json(asset, { status: 201 });
  } catch (err) {
    return handleServiceError(err);
  }
}
