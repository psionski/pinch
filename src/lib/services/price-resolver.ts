import { and, eq, gte, lte, sql, desc } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { assetPrices, marketPrices, assetLots } from "@/lib/db/schema";
import type { AssetResponse } from "@/lib/validators/assets";

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
 * Unified price resolver used by both `attachMetrics()` (current valuation) and
 * `PortfolioReportService` (historical reports).
 *
 * Resolution order for a given (asset, date):
 * 1. User override — asset_prices entry within ±1 day of date
 * 2. Provider data — for each (provider, symbol) in symbolMap, look up market_prices.
 *    This covers crypto, stocks, AND exchange rates (all stored in one table).
 *    For exchange rates the lookup uses (symbol=currency_code, currency=EUR).
 * 3. Lot cost basis — most recent lot's price_per_unit before date
 * 4. Deposit identity — EUR deposits only: price is always 1 (100 cents)
 */
export function resolvePrice(db: Db, asset: AssetResponse, date: string): ResolvedPrice | null {
  // Step 1: User override — asset_prices within ±1 day
  const userPrice = findUserPrice(db, asset.id, date);
  if (userPrice !== null) return { price: userPrice, source: "user" };

  // Step 2: Provider data — iterate symbolMap (provider, symbol) pairs
  if (asset.symbolMap) {
    for (const [provider, symbol] of Object.entries(asset.symbolMap)) {
      // Try with asset's own currency first (crypto/stocks priced in that currency)
      const mp = findCachedPrice(db, provider, symbol, asset.currency, date);
      if (mp !== null) return { price: mp, source: "market" };

      // Try with base currency (exchange rates: symbol=USD, currency=EUR)
      if (asset.currency !== BASE_CURRENCY) {
        const xr = findCachedPrice(db, provider, symbol, BASE_CURRENCY, date);
        if (xr !== null) return { price: xr, source: "market" };
      }
    }
  }

  // Step 3: Lot cost basis — most recent lot before date
  const lotPrice = findLotPrice(db, asset.id, date);
  if (lotPrice !== null) return { price: lotPrice, source: "lot" };

  // Step 4: Deposit identity — EUR deposits with no symbolMap or price data
  if (asset.type === "deposit" && asset.currency === BASE_CURRENCY) {
    return { price: 100, source: "deposit" };
  }

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

  // Latest provider price — try each (provider, symbol) pair
  let latestProviderPrice: number | null = null;
  if (asset.symbolMap) {
    for (const [provider, symbol] of Object.entries(asset.symbolMap)) {
      // Try asset currency
      const mp = findLatestCachedPrice(db, provider, symbol, asset.currency);
      if (mp !== null) {
        latestProviderPrice = mp;
        break;
      }
      // Try base currency (exchange rates)
      if (asset.currency !== BASE_CURRENCY) {
        const xr = findLatestCachedPrice(db, provider, symbol, BASE_CURRENCY);
        if (xr !== null) {
          latestProviderPrice = xr;
          break;
        }
      }
    }
  }

  // Pick the most recent between user and provider
  if (latestUserPrice && latestProviderPrice !== null) {
    return { price: latestUserPrice.pricePerUnit, source: "user" };
  }
  if (latestUserPrice) return { price: latestUserPrice.pricePerUnit, source: "user" };
  if (latestProviderPrice !== null) return { price: latestProviderPrice, source: "market" };

  // Deposit identity — EUR deposits with no other data
  if (asset.type === "deposit" && asset.currency === BASE_CURRENCY) {
    return { price: 100, source: "deposit" };
  }

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

/** Look up a cached price from the unified market_prices table within a 7-day window. */
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

/** Look up the latest cached price (no date constraint). */
function findLatestCachedPrice(
  db: Db,
  provider: string,
  symbol: string,
  currency: string
): number | null {
  const row = db
    .select({ price: marketPrices.price })
    .from(marketPrices)
    .where(
      and(
        eq(marketPrices.symbol, symbol),
        eq(marketPrices.provider, provider),
        eq(marketPrices.currency, currency)
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
