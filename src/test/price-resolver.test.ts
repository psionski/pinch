// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "./helpers";
import { AssetService } from "@/lib/services/assets";
import { AssetLotService } from "@/lib/services/asset-lots";
import { AssetPriceService } from "@/lib/services/asset-prices";
import { resolvePrice } from "@/lib/services/price-resolver";
import { marketPrices } from "@/lib/db/schema";
import { isoToday } from "@/lib/date-ranges";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schema from "@/lib/db/schema";

let db: BetterSQLite3Database<typeof schema>;
let assetService: AssetService;
let lotService: AssetLotService;
let priceService: AssetPriceService;

beforeEach(() => {
  db = makeTestDb();
  assetService = new AssetService(db);
  lotService = new AssetLotService(db);
  priceService = new AssetPriceService(db);
});

describe("resolvePrice", () => {
  it("returns user price when asset_prices entry exists near date", () => {
    const asset = assetService.create({ name: "SPX", type: "investment", currency: "EUR" });
    priceService.record(asset.id, { pricePerUnit: 35000, recordedAt: "2026-03-20T10:00:00Z" });

    const result = resolvePrice(db, asset, "2026-03-20");
    expect(result).not.toBeNull();
    expect(result!.price).toBe(35000);
    expect(result!.source).toBe("user");
  });

  it("returns market price when asset has symbolMap and market_prices has data", () => {
    const asset = assetService.create({
      name: "Bitcoin",
      type: "crypto",
      currency: "EUR",
      symbolMap: { coingecko: "bitcoin" },
    });

    db.insert(marketPrices)
      .values({
        symbol: "bitcoin",
        price: "80000.50",
        currency: "EUR",
        date: "2026-03-20",
        provider: "coingecko",
      })
      .run();

    const result = resolvePrice(db, asset, "2026-03-20");
    expect(result).not.toBeNull();
    expect(result!.price).toBe(8000050); // 80000.50 * 100
    expect(result!.source).toBe("market");
  });

  it("user price overrides market price", () => {
    const asset = assetService.create({
      name: "Bitcoin",
      type: "crypto",
      currency: "EUR",
      symbolMap: { coingecko: "bitcoin" },
    });

    priceService.record(asset.id, { pricePerUnit: 9000000, recordedAt: "2026-03-20T12:00:00Z" });
    db.insert(marketPrices)
      .values({
        symbol: "bitcoin",
        price: "80000",
        currency: "EUR",
        date: "2026-03-20",
        provider: "coingecko",
      })
      .run();

    const result = resolvePrice(db, asset, "2026-03-20");
    expect(result!.source).toBe("user");
    expect(result!.price).toBe(9000000);
  });

  it("falls back to lot cost basis when no prices", () => {
    const asset = assetService.create({ name: "ETF", type: "investment", currency: "EUR" });
    lotService.buy(asset.id, { quantity: 5, pricePerUnit: 10000, date: "2026-01-15" });

    const result = resolvePrice(db, asset, "2026-06-15");
    expect(result).not.toBeNull();
    expect(result!.source).toBe("lot");
    expect(result!.price).toBe(10000);
  });

  it("returns deposit identity for deposit assets with no other prices", () => {
    const asset = assetService.create({ name: "Savings", type: "deposit", currency: "EUR" });

    const result = resolvePrice(db, asset, "2026-03-20");
    expect(result).not.toBeNull();
    expect(result!.price).toBe(100);
    expect(result!.source).toBe("deposit");
  });

  it("returns null for investment with no price data", () => {
    const asset = assetService.create({ name: "Private Fund", type: "other", currency: "EUR" });

    const result = resolvePrice(db, asset, "2026-03-20");
    expect(result).toBeNull();
  });

  it("market price uses nearest within 7 days", () => {
    const asset = assetService.create({
      name: "Bitcoin",
      type: "crypto",
      currency: "EUR",
      symbolMap: { coingecko: "bitcoin" },
    });

    db.insert(marketPrices)
      .values({
        symbol: "bitcoin",
        price: "75000",
        currency: "EUR",
        date: "2026-03-15",
        provider: "coingecko",
      })
      .run();

    const result = resolvePrice(db, asset, "2026-03-20");
    expect(result).not.toBeNull();
    expect(result!.source).toBe("market");
    expect(result!.price).toBe(7500000);
  });

  it("uses cached price regardless of which provider stored it", () => {
    const asset = assetService.create({
      name: "Bitcoin",
      type: "crypto",
      currency: "EUR",
      symbolMap: { coingecko: "bitcoin" },
    });

    // Price cached by a different provider — cache key is (symbol, currency, date)
    db.insert(marketPrices)
      .values({
        symbol: "bitcoin",
        price: "99999",
        currency: "EUR",
        date: "2026-03-20",
        provider: "alpha-vantage",
      })
      .run();

    const result = resolvePrice(db, asset, "2026-03-20");
    expect(result?.source).toBe("market");
    expect(result?.price).toBe(9999900); // 99999 * 100
  });

  it("iterates multiple symbols in symbolMap", () => {
    const asset = assetService.create({
      name: "Bitcoin",
      type: "crypto",
      currency: "EUR",
      symbolMap: { coingecko: "bitcoin", "alpha-vantage": "BTC" },
    });

    // Only alpha-vantage symbol has data
    db.insert(marketPrices)
      .values({
        symbol: "BTC",
        price: "82000",
        currency: "EUR",
        date: "2026-03-20",
        provider: "alpha-vantage",
      })
      .run();

    const result = resolvePrice(db, asset, "2026-03-20");
    expect(result).not.toBeNull();
    expect(result!.source).toBe("market");
    expect(result!.price).toBe(8200000);
  });

  it("resolves foreign currency deposit via market_prices", () => {
    const asset = assetService.create({
      name: "USD Savings",
      type: "deposit",
      currency: "USD",
      symbolMap: { frankfurter: "USD" },
    });

    db.insert(marketPrices)
      .values({
        symbol: "USD",
        currency: "EUR",
        price: "0.92",
        date: "2026-03-20",
        provider: "frankfurter",
      })
      .run();

    const result = resolvePrice(db, asset, "2026-03-20");
    expect(result).not.toBeNull();
    expect(result!.source).toBe("market");
    expect(result!.price).toBe(92); // 0.92 * 100
  });

  it("exchange rate uses cached price regardless of provider", () => {
    const asset = assetService.create({
      name: "USD Savings",
      type: "deposit",
      currency: "USD",
      symbolMap: { frankfurter: "USD" },
    });

    // Rate cached by ECB — still valid since cache key is (symbol, currency, date)
    db.insert(marketPrices)
      .values({
        symbol: "USD",
        currency: "EUR",
        price: "0.92",
        date: "2026-03-20",
        provider: "ecb",
      })
      .run();

    const result = resolvePrice(db, asset, "2026-03-20");
    expect(result?.source).toBe("market");
    expect(result?.price).toBe(92); // 0.92 * 100
  });
});

describe("resolvePrice (no date — defaults to today)", () => {
  it("returns latest user price when available", () => {
    const today = isoToday();
    const asset = assetService.create({ name: "SPX", type: "investment", currency: "EUR" });
    priceService.record(asset.id, { pricePerUnit: 30000, recordedAt: "2026-01-01T00:00:00Z" });
    priceService.record(asset.id, { pricePerUnit: 35000, recordedAt: `${today}T00:00:00Z` });

    const result = resolvePrice(db, asset);
    expect(result!.price).toBe(35000);
    expect(result!.source).toBe("user");
  });

  it("returns market price for asset with symbolMap and no user prices", () => {
    const today = isoToday();
    const asset = assetService.create({
      name: "Bitcoin",
      type: "crypto",
      currency: "EUR",
      symbolMap: { coingecko: "bitcoin" },
    });

    db.insert(marketPrices)
      .values({
        symbol: "bitcoin",
        price: "85000",
        currency: "EUR",
        date: today,
        provider: "coingecko",
      })
      .run();

    const result = resolvePrice(db, asset);
    expect(result).not.toBeNull();
    expect(result!.source).toBe("market");
    expect(result!.price).toBe(8500000);
  });

  it("returns exchange rate for foreign currency deposit", () => {
    const today = isoToday();
    const asset = assetService.create({
      name: "GBP Savings",
      type: "deposit",
      currency: "GBP",
      symbolMap: { frankfurter: "GBP" },
    });

    db.insert(marketPrices)
      .values({
        symbol: "GBP",
        currency: "EUR",
        price: "1.17",
        date: today,
        provider: "frankfurter",
      })
      .run();

    const result = resolvePrice(db, asset);
    expect(result).not.toBeNull();
    expect(result!.source).toBe("market");
    expect(result!.price).toBe(117); // 1.17 * 100
  });

  it("returns deposit fallback for EUR deposits", () => {
    const asset = assetService.create({ name: "Savings", type: "deposit", currency: "EUR" });
    const result = resolvePrice(db, asset);
    expect(result!.price).toBe(100);
    expect(result!.source).toBe("deposit");
  });

  it("returns null for foreign currency deposit without symbolMap", () => {
    const asset = assetService.create({ name: "USD Fund", type: "deposit", currency: "USD" });
    const result = resolvePrice(db, asset);
    expect(result).toBeNull();
  });
});
