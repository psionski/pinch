// @vitest-environment node
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { makeTestDb } from "./helpers";
import { FinancialDataService } from "@/lib/services/financial-data";
import { SettingsService } from "@/lib/services/settings";
import type { PriceResult } from "@/lib/providers/types";
import type { ProviderName } from "@/lib/providers/types";
import type { ProviderFactory } from "@/lib/services/financial-data";

// ─── Mock providers ───────────────────────────────────────────────────────────

function makeRateProvider(name: ProviderName, rate: number | null) {
  return {
    name,
    getPrice: vi.fn(
      async (symbol: string, currency: string, date?: string): Promise<PriceResult | null> => {
        if (rate === null) return null;
        return { symbol, currency, price: rate, date: date ?? "2026-03-20", provider: name };
      }
    ),
    getPrices: vi.fn(async (symbol: string, date?: string): Promise<PriceResult[]> => {
      if (rate === null) return [];
      return [{ symbol, currency: "EUR", price: rate, date: date ?? "2026-03-20", provider: name }];
    }),
  };
}

function makePriceProvider(name: ProviderName, price: number | null) {
  return {
    name,
    getPrice: vi.fn(
      async (symbol: string, currency: string, date?: string): Promise<PriceResult | null> => {
        if (price === null) return null;
        return { symbol, price, currency, date: date ?? "2026-03-20", provider: name };
      }
    ),
  };
}

/** Create a factory that returns the given mock provider for its name. */
function mockFactory(
  ...providers: Array<{ name: ProviderName; [key: string]: unknown }>
): ProviderFactory {
  const map = new Map(providers.map((p) => [p.name, p]));
  return (name: ProviderName) => (map.get(name) as ReturnType<ProviderFactory>) ?? null;
}

// ─── Service under test ───────────────────────────────────────────────────────

let service: FinancialDataService;
let settingsService: SettingsService;

beforeEach(() => {
  const db = makeTestDb();
  settingsService = new SettingsService(db);
  service = new FinancialDataService(db, settingsService);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Cache behaviour ──────────────────────────────────────────────────────────

describe("getPrice — caching (exchange rates)", () => {
  it("caches and returns a rate on second call without hitting provider again", async () => {
    const provider = makeRateProvider("frankfurter", 0.92);
    const db = makeTestDb();
    const svc = new FinancialDataService(db, new SettingsService(db), mockFactory(provider));

    const first = await svc.getPrice({ frankfurter: "USD" }, "EUR", "2026-01-15");
    const second = await svc.getPrice({ frankfurter: "USD" }, "EUR", "2026-01-15");

    expect(first?.price).toBeCloseTo(0.92);
    expect(second?.price).toBeCloseTo(0.92);
    // Provider should only have been called once (cache hit on second call)
    expect(provider.getPrice).toHaveBeenCalledTimes(1);
  });

  it("historical rates are cached indefinitely", async () => {
    const provider = makeRateProvider("frankfurter", 0.9);
    const db = makeTestDb();
    const svc = new FinancialDataService(db, new SettingsService(db), mockFactory(provider));

    await svc.getPrice({ frankfurter: "USD" }, "EUR", "2020-06-01");
    await svc.getPrice({ frankfurter: "USD" }, "EUR", "2020-06-01");

    expect(provider.getPrice).toHaveBeenCalledTimes(1);
  });
});

describe("getPrice — provider fallback", () => {
  it("tries next provider when first returns null", async () => {
    const failingProvider = makeRateProvider("frankfurter", null);
    const goodProvider = makeRateProvider("ecb", 0.85);
    const db = makeTestDb();
    const svc = new FinancialDataService(
      db,
      new SettingsService(db),
      mockFactory(failingProvider, goodProvider)
    );

    const result = await svc.getPrice({ frankfurter: "USD", ecb: "USD" }, "EUR", "2026-03-01");
    expect(result?.price).toBeCloseTo(0.85);
    expect(result?.provider).toBe("ecb");
    expect(failingProvider.getPrice).toHaveBeenCalledTimes(1);
    expect(goodProvider.getPrice).toHaveBeenCalledTimes(1);
  });

  it("returns null when all providers fail and no cache", async () => {
    const failingProvider = makeRateProvider("frankfurter", null);
    const db = makeTestDb();
    const svc = new FinancialDataService(db, new SettingsService(db), mockFactory(failingProvider));

    const result = await svc.getPrice({ frankfurter: "USD" }, "EUR", "2026-03-01");
    expect(result).toBeNull();
  });

  it("returns stale cached result when all providers fail", async () => {
    const provider = makeRateProvider("frankfurter", 0.91);
    const db = makeTestDb();
    const svc = new FinancialDataService(db, new SettingsService(db), mockFactory(provider));

    // First call: prime the cache
    await svc.getPrice({ frankfurter: "USD" }, "EUR", "2026-03-01");

    // Second call: provider now fails
    provider.getPrice.mockResolvedValue(null);
    const result = await svc.getPrice({ frankfurter: "USD" }, "EUR", "2026-03-01");
    // Historical date → always hits cache (immutable), so stale flag is false here
    expect(result).not.toBeNull();
    expect(result?.price).toBeCloseTo(0.91);
  });

  it("skips providers not in the symbolMap", async () => {
    const frankfurter = makeRateProvider("frankfurter", 0.92);
    const ecb = makeRateProvider("ecb", 0.93);
    const db = makeTestDb();
    const svc = new FinancialDataService(
      db,
      new SettingsService(db),
      mockFactory(frankfurter, ecb)
    );

    // Only pass ecb in the symbolMap
    const result = await svc.getPrice({ ecb: "USD" }, "EUR", "2026-03-01");
    expect(result?.price).toBeCloseTo(0.93);
    expect(result?.provider).toBe("ecb");
    expect(frankfurter.getPrice).not.toHaveBeenCalled();
    expect(ecb.getPrice).toHaveBeenCalledTimes(1);
  });

  it("skips provider when factory returns null (missing API key)", async () => {
    const db = makeTestDb();
    const svc = new FinancialDataService(db, new SettingsService(db), () => null);

    const result = await svc.getPrice({ "alpha-vantage": "AAPL" }, "USD", "2026-03-01");
    expect(result).toBeNull();
  });
});

// ─── convert ──────────────────────────────────────────────────────────────────

describe("convert", () => {
  it("converts same currency with no API call", async () => {
    const result = await service.convert(1000, "EUR", "EUR", {});
    expect(result?.converted).toBe(1000);
    expect(result?.rate).toBe(1);
  });

  it("converts amount using exchange rate", async () => {
    const provider = makeRateProvider("frankfurter", 0.92);
    const db = makeTestDb();
    const svc = new FinancialDataService(db, new SettingsService(db), mockFactory(provider));

    const result = await svc.convert(10000, "USD", "EUR", { frankfurter: "USD" }, "2026-01-15");
    expect(result?.converted).toBe(9200); // 10000 * 0.92
    expect(result?.rate).toBeCloseTo(0.92);
  });

  it("returns null when no rate is available", async () => {
    const failProvider = makeRateProvider("frankfurter", null);
    const db = makeTestDb();
    const svc = new FinancialDataService(db, new SettingsService(db), mockFactory(failProvider));

    const result = await svc.convert(1000, "USD", "EUR", { frankfurter: "USD" });
    expect(result).toBeNull();
  });
});

// ─── getPrice (market prices) ───────────────────────────────────────────────

describe("getPrice — caching (market prices)", () => {
  it("caches and returns a price on second call", async () => {
    const provider = makePriceProvider("coingecko", 85000.0);
    const db = makeTestDb();
    const svc = new FinancialDataService(db, new SettingsService(db), mockFactory(provider));

    const first = await svc.getPrice({ coingecko: "bitcoin" }, "EUR", "2026-01-15");
    const second = await svc.getPrice({ coingecko: "bitcoin" }, "EUR", "2026-01-15");

    expect(first?.price).toBeCloseTo(85000);
    expect(second?.price).toBeCloseTo(85000);
    expect(provider.getPrice).toHaveBeenCalledTimes(1);
  });
});

// ─── API key management ────────────────────────────────────────────────────────

describe("setApiKey / getApiKey", () => {
  it("stores and retrieves an API key", () => {
    service.setApiKey("coingecko", "test-key-123");
    expect(service.getApiKey("coingecko")).toBe("test-key-123");
  });

  it("returns null for provider with no key", () => {
    expect(service.getApiKey("alpha-vantage")).toBeNull();
  });
});
