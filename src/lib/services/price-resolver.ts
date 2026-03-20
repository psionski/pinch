import { and, eq, gte, lte, sql, desc } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { assetPrices, marketPrices, assetLots } from "@/lib/db/schema";
import type { AssetResponse } from "@/lib/validators/assets";

type Db = BetterSQLite3Database<typeof schema>;

export type PriceSource = "user" | "market" | "lot" | "deposit";

export interface ResolvedPrice {
  /** Price in cents, in the asset's currency. */
  price: number;
  source: PriceSource;
}

/**
 * Unified price resolver used by both `attachMetrics()` (current valuation) and
 * `PortfolioReportService` (historical reports).
 *
 * Resolution order for a given (asset, date):
 * 1. User override — asset_prices entry within ±1 day of date
 * 2. Market price — market_prices for any (provider, symbol) in symbolMap, nearest within 7 days
 * 3. Lot cost basis — most recent lot's price_per_unit before date
 * 4. Deposit identity — deposits: price is always 1 (100 cents)
 */
export function resolvePrice(db: Db, asset: AssetResponse, date: string): ResolvedPrice | null {
  // Step 1: User override — asset_prices within ±1 day
  const userPrice = findUserPrice(db, asset.id, date);
  if (userPrice !== null) return { price: userPrice, source: "user" };

  // Step 2: Market price — iterate symbolMap entries
  if (asset.symbolMap) {
    for (const symbol of Object.values(asset.symbolMap)) {
      const marketPrice = findMarketPrice(db, symbol, asset.currency, date);
      if (marketPrice !== null) return { price: marketPrice, source: "market" };
    }
  }

  // Step 3: Lot cost basis — most recent lot before date
  const lotPrice = findLotPrice(db, asset.id, date);
  if (lotPrice !== null) return { price: lotPrice, source: "lot" };

  // Step 4: Deposit identity — 1 unit = 1 currency unit
  if (asset.type === "deposit") return { price: 100, source: "deposit" };

  return null;
}

/**
 * Resolve the current/latest price for an asset (no date constraint).
 * Used by `attachMetrics()` for real-time valuation.
 */
export function resolveLatestPrice(db: Db, asset: AssetResponse): ResolvedPrice | null {
  // Latest user-recorded price
  const latestUserPrice = db
    .select({ pricePerUnit: assetPrices.pricePerUnit })
    .from(assetPrices)
    .where(eq(assetPrices.assetId, asset.id))
    .orderBy(desc(assetPrices.recordedAt))
    .limit(1)
    .get();

  // Latest market price — try each symbol in the map
  let latestMarketPrice: number | null = null;
  if (asset.symbolMap) {
    for (const symbol of Object.values(asset.symbolMap)) {
      const mp = db
        .select({ price: marketPrices.price })
        .from(marketPrices)
        .where(and(eq(marketPrices.symbol, symbol), eq(marketPrices.currency, asset.currency)))
        .orderBy(desc(marketPrices.date))
        .limit(1)
        .get();
      if (mp) {
        latestMarketPrice = Math.round(parseFloat(mp.price) * 100);
        break; // first match wins
      }
    }
  }

  // Pick the most recent between user and market
  if (latestUserPrice && latestMarketPrice !== null) {
    // Both exist — user price takes precedence (deliberate override)
    return { price: latestUserPrice.pricePerUnit, source: "user" };
  }
  if (latestUserPrice) return { price: latestUserPrice.pricePerUnit, source: "user" };
  if (latestMarketPrice !== null) return { price: latestMarketPrice, source: "market" };

  // Deposit identity fallback
  if (asset.type === "deposit") return { price: 100, source: "deposit" };

  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findUserPrice(db: Db, assetId: number, date: string): number | null {
  const dayBefore = offsetDate(date, -1);
  const dayAfter = offsetDate(date, 1);

  const row = db
    .select({ pricePerUnit: assetPrices.pricePerUnit })
    .from(assetPrices)
    .where(
      and(
        eq(assetPrices.assetId, assetId),
        gte(assetPrices.recordedAt, dayBefore),
        lte(assetPrices.recordedAt, dayAfter + "T23:59:59Z")
      )
    )
    .orderBy(sql`abs(julianday(substr(${assetPrices.recordedAt}, 1, 10)) - julianday(${date}))`)
    .limit(1)
    .get();

  return row?.pricePerUnit ?? null;
}

function findMarketPrice(db: Db, symbol: string, currency: string, date: string): number | null {
  const weekBefore = offsetDate(date, -7);

  const row = db
    .select({ price: marketPrices.price, date: marketPrices.date })
    .from(marketPrices)
    .where(
      and(
        eq(marketPrices.symbol, symbol),
        eq(marketPrices.currency, currency),
        gte(marketPrices.date, weekBefore),
        lte(marketPrices.date, date)
      )
    )
    .orderBy(desc(marketPrices.date))
    .limit(1)
    .get();

  if (row) return Math.round(parseFloat(row.price) * 100);
  return null;
}

function findLotPrice(db: Db, assetId: number, date: string): number | null {
  const row = db
    .select({ pricePerUnit: assetLots.pricePerUnit })
    .from(assetLots)
    .where(and(eq(assetLots.assetId, assetId), lte(assetLots.date, date)))
    .orderBy(desc(assetLots.date), desc(assetLots.id))
    .limit(1)
    .get();

  return row?.pricePerUnit ?? null;
}

function offsetDate(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
