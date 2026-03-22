import { and, eq, gte, lte, sql, desc } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { assetPrices, marketPrices, assetLots } from "@/lib/db/schema";
import type { AssetResponse } from "@/lib/validators/assets";
import { isoToday, offsetDate } from "@/lib/date-ranges";

type Db = BetterSQLite3Database<typeof schema>;

/** Base currency for the app. All portfolio-level valuations are in this currency. */
const BASE_CURRENCY = "EUR";

export type PriceSource = "user" | "market" | "lot" | "deposit";

export interface ResolvedPrice {
  /** Price in cents. */
  price: number;
  source: PriceSource;
}

/**
 * Unified price resolver for both current valuation and historical reports.
 *
 * Lookups are always windowed around the target date (±1 day for user prices,
 * 7-day window for market prices, lots before date). When `date` is omitted
 * it defaults to today, so CRUD and reporting paths behave identically.
 *
 * Resolution order:
 * 1. Deposit identity — EUR deposits: price is always 1 (100 cents), no DB needed
 * 2. User override — asset_prices entry
 * 3. Provider data — for each (provider, symbol) in symbolMap, look up market_prices.
 *    This covers crypto, stocks, AND exchange rates (all stored in one table).
 *    For exchange rates the lookup uses (symbol=currency_code, currency=EUR).
 * 4. Lot cost basis — most recent lot's price_per_unit
 */
export function resolvePrice(db: Db, asset: AssetResponse, date?: string): ResolvedPrice | null {
  const effectiveDate = date ?? isoToday();
  // Step 1: Deposit identity — EUR deposits are always €1/unit, skip SQL
  if (asset.type === "deposit" && asset.currency === BASE_CURRENCY) {
    return { price: 100, source: "deposit" };
  }

  // Step 2: User override
  const userPrice = findUserPrice(db, asset.id, effectiveDate);
  if (userPrice !== null) return { price: userPrice, source: "user" };

  // Step 3: Provider data — iterate symbolMap (provider, symbol) pairs
  if (asset.symbolMap) {
    for (const [provider, symbol] of Object.entries(asset.symbolMap)) {
      // Try with asset's own currency first (crypto/stocks priced in that currency)
      const mp = findCachedPrice(db, provider, symbol, asset.currency, effectiveDate);
      if (mp !== null) return { price: mp, source: "market" };

      // Try with base currency (exchange rates: symbol=USD, currency=EUR)
      if (asset.currency !== BASE_CURRENCY) {
        const xr = findCachedPrice(db, provider, symbol, BASE_CURRENCY, effectiveDate);
        if (xr !== null) return { price: xr, source: "market" };
      }
    }
  }

  // Step 4: Lot cost basis
  const lotPrice = findLotPrice(db, asset.id, effectiveDate);
  if (lotPrice !== null) return { price: lotPrice, source: "lot" };

  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** User-recorded price within ±1 day of `date`, closest first. */
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

/** Cached market price within 7-day lookback window from `date`. */
function findCachedPrice(
  db: Db,
  provider: string,
  symbol: string,
  currency: string,
  date: string
): number | null {
  const weekBefore = offsetDate(date, -7);

  const row = db
    .select({ price: marketPrices.price })
    .from(marketPrices)
    .where(
      and(
        eq(marketPrices.symbol, symbol),
        eq(marketPrices.provider, provider),
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

/** Lot cost basis — most recent lot at or before `date`. */
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
