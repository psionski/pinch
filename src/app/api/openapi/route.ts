import { NextResponse } from "next/server";
import { generateOpenApiDocument } from "@/lib/api/openapi";

let cachedDoc: ReturnType<typeof generateOpenApiDocument> | null = null;

export async function GET(): Promise<NextResponse> {
  if (!cachedDoc) {
    cachedDoc = generateOpenApiDocument();
  }
  return NextResponse.json(cachedDoc, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
