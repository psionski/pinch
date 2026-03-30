import { sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { transactions } from "@/lib/db/schema";
import { AssetService } from "./assets";
import type { PortfolioResponse } from "@/lib/validators/assets";

type Db = BetterSQLite3Database<typeof schema>;

export class PortfolioService {
  private assetService: AssetService;

  constructor(private db: Db) {
    this.assetService = new AssetService(db);
  }

  getPortfolio(): PortfolioResponse {
    // Cash balance: income − expenses + transfers (signed: negative = purchase, positive = sale).
    // Transfer amounts are signed, so a single sum covers both asset purchases and sales.
    const [balRow] = this.db
      .select({
        income:
          sql<number>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount} else 0 end), 0)`.mapWith(
            Number
          ),
        expenses:
          sql<number>`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amount} else 0 end), 0)`.mapWith(
            Number
          ),
        transfers:
          sql<number>`coalesce(sum(case when ${transactions.type} = 'transfer' then ${transactions.amount} else 0 end), 0)`.mapWith(
            Number
          ),
      })
      .from(transactions)
      .all();

    const cashBalance = (balRow?.income ?? 0) - (balRow?.expenses ?? 0) + (balRow?.transfers ?? 0);

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
