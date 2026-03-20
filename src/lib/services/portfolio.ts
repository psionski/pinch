import { eq, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { transactions, assetLots } from "@/lib/db/schema";
import { AssetService } from "./assets";
import type { PortfolioResponse } from "@/lib/validators/assets";

type Db = BetterSQLite3Database<typeof schema>;

export class PortfolioService {
  private assetService: AssetService;

  constructor(private db: Db) {
    this.assetService = new AssetService(db);
  }

  getNetWorth(): PortfolioResponse {
    // Cash balance: income − expenses − asset purchases + asset sales.
    // Asset buy/sell transactions are type='transfer' and excluded from income/expense
    // totals, but we explicitly account for them here so that moving money into/out of
    // assets is net-worth-neutral (buying assets shouldn't increase net worth).
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
      })
      .from(transactions)
      .all();

    // Asset-linked transfer flows (via asset_lots → transactions join)
    const [assetFlowRow] = this.db
      .select({
        purchases:
          sql<number>`coalesce(sum(case when ${assetLots.quantity} > 0 then ${transactions.amount} else 0 end), 0)`.mapWith(
            Number
          ),
        sales:
          sql<number>`coalesce(sum(case when ${assetLots.quantity} < 0 then ${transactions.amount} else 0 end), 0)`.mapWith(
            Number
          ),
      })
      .from(assetLots)
      .innerJoin(transactions, eq(assetLots.transactionId, transactions.id))
      .all();

    const cashBalance =
      (balRow?.income ?? 0) -
      (balRow?.expenses ?? 0) -
      (assetFlowRow?.purchases ?? 0) +
      (assetFlowRow?.sales ?? 0);

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
