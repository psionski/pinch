import { NextResponse } from "next/server";
import { getAssetService } from "@/lib/api/services";
import { parseBody, isErrorResponse, handleServiceError } from "@/lib/api/helpers";
import { CreateAssetSchema } from "@/lib/validators/assets";

export function GET(): NextResponse {
  const assets = getAssetService().list();
  return NextResponse.json(assets);
}

export async function POST(req: Request): Promise<NextResponse> {
  const input = await parseBody(req, CreateAssetSchema);
  if (isErrorResponse(input)) return input;

  try {
    const asset = getAssetService().create(input);
    return NextResponse.json(asset, { status: 201 });
  } catch (err) {
    return handleServiceError(err);
  }
}
