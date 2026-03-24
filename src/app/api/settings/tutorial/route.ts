import { NextResponse } from "next/server";
import { getSettingsService } from "@/lib/api/services";

export function GET(): NextResponse {
  const value = getSettingsService().get("tutorial");
  return NextResponse.json({ tutorial: value === "true" });
}

export async function PUT(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { tutorial } = body as { tutorial?: boolean };
  if (typeof tutorial !== "boolean") {
    return NextResponse.json({ error: "tutorial must be a boolean" }, { status: 400 });
  }

  getSettingsService().set("tutorial", tutorial ? "true" : "false");
  return NextResponse.json({ tutorial });
}
