import { NextResponse } from "next/server";
import { getPortfolioReportService } from "@/lib/api/services";

export function GET(): NextResponse {
  const data = getPortfolioReportService().getCurrencyExposure();
  return NextResponse.json(data);
}
