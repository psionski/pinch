import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { AssetService } from "./assets";
import { ReportService } from "./reports";
import type { PortfolioResponse } from "@/lib/validators/assets";

type Db = BetterSQLite3Database<typeof schema>;

export class PortfolioService {
  private assetService: AssetService;
  private reportService: ReportService;

  constructor(db: Db) {
    this.assetService = new AssetService(db);
    this.reportService = new ReportService(db);
  }

  getPortfolio(): PortfolioResponse {
    const { cashBalance } = this.reportService.cashBalance();

    // Assets with metrics
    const allAssets = this.assetService.list();

    let totalAssetValue = 0;
    let pnlTotal = 0;
    let hasSomePnl = false;

    for (const a of allAssets) {
      if (a.currentValue !== null) {
        totalAssetValue += a.currentValue;
      }
      if (a.pnl !== null) {
        pnlTotal += a.pnl;
        hasSomePnl = true;
      }
    }

    const netWorth = cashBalance + totalAssetValue;
    // Show partial P&L from assets that have a known price; null if none do (incl. no assets).
    const pnl = hasSomePnl ? pnlTotal : null;

    // Allocation percentages
    const allocation = allAssets
      .filter((a) => a.currentValue !== null && a.currentValue > 0)
      .map((a) => ({
        assetId: a.id,
        name: a.name,
        currentValue: a.currentValue!,
        pct:
          totalAssetValue > 0 ? Math.round((a.currentValue! / totalAssetValue) * 10000) / 100 : 0,
      }));

    return {
      assets: allAssets,
      cashBalance,
      totalAssetValue,
      netWorth,
      pnl,
      allocation,
    };
  }
}
