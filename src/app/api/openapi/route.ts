import { NextResponse } from "next/server";
import { generateOpenApiDocument } from "@/lib/api/openapi";

export const dynamic = "force-static";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(generateOpenApiDocument());
}
