import { NextResponse } from "next/server";
import { getSettingsService } from "@/lib/api/services";
import { getProviderStatuses } from "@/lib/providers/registry";

export async function GET(): Promise<NextResponse> {
  const statuses = await getProviderStatuses(getSettingsService());
  return NextResponse.json(statuses);
}
