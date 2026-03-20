import { NextResponse } from "next/server";
import { getPortfolioService } from "@/lib/api/services";

export function GET(): NextResponse {
  const portfolio = getPortfolioService().getPortfolio();
  return NextResponse.json(portfolio);
}
