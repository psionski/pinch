import { NextResponse } from "next/server";
import { getSettingsService } from "@/lib/api/services";

export function GET(): NextResponse {
  const tutorial = getSettingsService().get("tutorial");
  return NextResponse.json({ tutorial });
}

export function DELETE(): NextResponse {
  getSettingsService().delete("tutorial");
  return NextResponse.json({ ok: true });
}
