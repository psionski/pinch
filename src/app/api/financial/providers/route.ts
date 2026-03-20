import { NextResponse } from "next/server";
import { getFinancialDataService } from "@/lib/api/services";

export async function GET(): Promise<NextResponse> {
  const statuses = await getFinancialDataService().getProviderStatus();
  return NextResponse.json(statuses);
}
