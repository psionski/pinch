import { eq, asc } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { assetLots } from "@/lib/db/schema";
import type { FinancialDataService } from "./financial-data";
import type { SymbolMap } from "@/lib/validators/assets";
import { financialLogger } from "@/lib/logger";

type Db = BetterSQLite3Database<typeof schema>;

/**
 * Trigger price history backfill for an asset with market symbols.
 * Call this fire-and-forget after creating/updating an asset with a symbolMap.
 * Populates market_prices for each provider-symbol pair from the asset's earliest
 * lot date through today, and exchange_rates for non-EUR assets.
 */
export function triggerSymbolBackfill(
  db: Db,
  financialDataService: FinancialDataService,
  asset: { id: number; symbolMap: SymbolMap | null; currency: string }
): void {
  if (!asset.symbolMap || Object.keys(asset.symbolMap).length === 0) return;

  const today = new Date().toISOString().slice(0, 10);

  // Find earliest lot date for this asset
  const earliestLot = db
    .select({ date: assetLots.date })
    .from(assetLots)
    .where(eq(assetLots.assetId, asset.id))
    .orderBy(asc(assetLots.date))
    .limit(1)
    .get();

  const from = earliestLot?.date ?? today;

  // Fire-and-forget: backfill market prices for each provider-symbol pair
  void (async () => {
    try {
      for (const symbol of Object.values(asset.symbolMap!)) {
        await financialDataService.ensurePriceHistory(symbol, asset.currency, from, today);
      }

      // For non-EUR assets, also backfill exchange rates to EUR
      if (asset.currency !== "EUR") {
        await financialDataService.ensurePriceHistory(asset.currency, "EUR", from, today);
      }
    } catch (err) {
      financialLogger.warn({ assetId: asset.id, err }, "Symbol backfill failed");
    }
  })();
}
