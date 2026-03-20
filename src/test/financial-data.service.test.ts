// @vitest-environment node
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { makeTestDb } from "./helpers";
import { FinancialDataService } from "@/lib/services/financial-data";
import { SettingsService } from "@/lib/services/settings";
import type { PriceResult } from "@/lib/providers/types";

// ─── Mock providers ───────────────────────────────────────────────────────────

function makeRateProvider(name: string, rate: number | null) {
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

function makePriceProvider(name: string, price: number | null) {
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
    const provider = makeRateProvider("mock", 0.92);

    // Subclass to inject mock provider
    class TestService extends FinancialDataService {
      protected override buildAllProviders() {
        return [provider];
      }
    }
    const db = makeTestDb();
    const svc = new TestService(db, new SettingsService(db));

    const first = await svc.getPrice("USD", "EUR", "2026-01-15");
    const second = await svc.getPrice("USD", "EUR", "2026-01-15");

    expect(first?.price).toBeCloseTo(0.92);
    expect(second?.price).toBeCloseTo(0.92);
    // Provider should only have been called once (cache hit on second call)
    expect(provider.getPrice).toHaveBeenCalledTimes(1);
  });

  it("historical rates are cached indefinitely", async () => {
    const provider = makeRateProvider("mock", 0.9);

    class TestService extends FinancialDataService {
      protected override buildAllProviders() {
        return [provider];
      }
    }
    const db = makeTestDb();
    const svc = new TestService(db, new SettingsService(db));

    await svc.getPrice("USD", "EUR", "2020-06-01");
    await svc.getPrice("USD", "EUR", "2020-06-01");

    expect(provider.getPrice).toHaveBeenCalledTimes(1);
  });
});

describe("getPrice — provider fallback", () => {
  it("tries next provider when first returns null", async () => {
    const failingProvider = makeRateProvider("failing", null);
    const goodProvider = makeRateProvider("good", 0.85);

    class TestService extends FinancialDataService {
      protected override buildAllProviders() {
        return [failingProvider, goodProvider];
      }
    }
    const db = makeTestDb();
    const svc = new TestService(db, new SettingsService(db));

    const result = await svc.getPrice("USD", "EUR", "2026-03-01");
    expect(result?.price).toBeCloseTo(0.85);
    expect(result?.provider).toBe("good");
    expect(failingProvider.getPrice).toHaveBeenCalledTimes(1);
    expect(goodProvider.getPrice).toHaveBeenCalledTimes(1);
  });

  it("returns null when all providers fail and no cache", async () => {
    const failingProvider = makeRateProvider("failing", null);

    class TestService extends FinancialDataService {
      protected override buildAllProviders() {
        return [failingProvider];
      }
    }
    const db = makeTestDb();
    const svc = new TestService(db, new SettingsService(db));

    const result = await svc.getPrice("USD", "EUR", "2026-03-01");
    expect(result).toBeNull();
  });

  it("returns stale cached result when all providers fail", async () => {
    const provider = makeRateProvider("mock", 0.91);

    class TestService extends FinancialDataService {
      protected override buildAllProviders() {
        return [provider];
      }
    }
    const db = makeTestDb();
    const svc = new TestService(db, new SettingsService(db));

    // First call: prime the cache
    await svc.getPrice("USD", "EUR", "2026-03-01");

    // Second call: provider now fails
    provider.getPrice.mockResolvedValue(null);
    const result = await svc.getPrice("USD", "EUR", "2026-03-01");
    // Historical date → always hits cache (immutable), so stale flag is false here
    expect(result).not.toBeNull();
    expect(result?.price).toBeCloseTo(0.91);
  });
});

// ─── convert ──────────────────────────────────────────────────────────────────

describe("convert", () => {
  it("converts same currency with no API call", async () => {
    const result = await service.convert(1000, "EUR", "EUR");
    expect(result?.converted).toBe(1000);
    expect(result?.rate).toBe(1);
    expect(result?.provider).toBe("none");
  });

  it("converts amount using exchange rate", async () => {
    const provider = makeRateProvider("mock", 0.92);

    class TestService extends FinancialDataService {
      protected override buildAllProviders() {
        return [provider];
      }
    }
    const db = makeTestDb();
    const svc = new TestService(db, new SettingsService(db));

    const result = await svc.convert(10000, "USD", "EUR", "2026-01-15");
    expect(result?.converted).toBe(9200); // 10000 * 0.92
    expect(result?.rate).toBeCloseTo(0.92);
  });

  it("returns null when no rate is available", async () => {
    const failProvider = makeRateProvider("fail", null);

    class TestService extends FinancialDataService {
      protected override buildAllProviders() {
        return [failProvider];
      }
    }
    const db = makeTestDb();
    const svc = new TestService(db, new SettingsService(db));

    const result = await svc.convert(1000, "USD", "EUR");
    expect(result).toBeNull();
  });
});

// ─── getPrice (market prices) ───────────────────────────────────────────────

describe("getPrice — caching (market prices)", () => {
  it("caches and returns a price on second call", async () => {
    const provider = makePriceProvider("mock-cg", 85000.0);

    class TestService extends FinancialDataService {
      protected override buildAllProviders() {
        return [provider];
      }
    }
    const db = makeTestDb();
    const svc = new TestService(db, new SettingsService(db));

    const first = await svc.getPrice("bitcoin", "EUR", "2026-01-15");
    const second = await svc.getPrice("bitcoin", "EUR", "2026-01-15");

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
