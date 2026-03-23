// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { FrankfurterProvider } from "@/lib/providers/frankfurter";
import { EcbProvider } from "@/lib/providers/ecb";
import { CoinGeckoProvider } from "@/lib/providers/coingecko";
import { AlphaVantageProvider } from "@/lib/providers/alpha-vantage";
import { OpenExchangeRatesProvider } from "@/lib/providers/open-exchange-rates";

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Frankfurter ──────────────────────────────────────────────────────────────

describe("FrankfurterProvider", () => {
  const provider = new FrankfurterProvider();

  it("parses getPrice response correctly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          date: "2026-01-15",
          base: "USD",
          rates: { EUR: 0.92 },
        }),
      })
    );

    const result = await provider.getPrice("USD", "EUR", "2026-01-15");
    expect(result).not.toBeNull();
    expect(result!.symbol).toBe("USD");
    expect(result!.currency).toBe("EUR");
    expect(result!.price).toBeCloseTo(0.92);
    expect(result!.date).toBe("2026-01-15");
    expect(result!.provider).toBe("frankfurter");
  });

  it("returns null on HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const result = await provider.getPrice("USD", "EUR");
    expect(result).toBeNull();
  });

  it("returns null when quote not in response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ date: "2026-01-15", base: "USD", rates: { GBP: 0.78 } }),
      })
    );
    const result = await provider.getPrice("USD", "EUR");
    expect(result).toBeNull();
  });

  it("getPrices returns all pairs for a base", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          date: "2026-01-15",
          base: "EUR",
          rates: { USD: 1.08, GBP: 0.86, JPY: 163.5 },
        }),
      })
    );

    const results = await provider.getPrices("EUR");
    expect(results).toHaveLength(3);
    expect(results.map((r) => r.currency).sort()).toEqual(["GBP", "JPY", "USD"]);
    expect(results.every((r) => r.symbol === "EUR")).toBe(true);
  });
});

// ─── ECB ─────────────────────────────────────────────────────────────────────

const ECB_DAILY_XML = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01"
                 xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
  <Cube>
    <Cube time="2026-01-15">
      <Cube currency="USD" rate="1.0870"/>
      <Cube currency="GBP" rate="0.8600"/>
      <Cube currency="JPY" rate="163.50"/>
    </Cube>
  </Cube>
</gesmes:Envelope>`;

describe("EcbProvider", () => {
  const provider = new EcbProvider();

  it("parses EUR→USD rate correctly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => ECB_DAILY_XML,
      })
    );

    const result = await provider.getPrice("EUR", "USD");
    expect(result).not.toBeNull();
    expect(result!.symbol).toBe("EUR");
    expect(result!.currency).toBe("USD");
    expect(result!.price).toBeCloseTo(1.087);
  });

  it("converts non-EUR base correctly (USD→GBP)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => ECB_DAILY_XML,
      })
    );

    // USD→GBP: GBP_in_EUR / USD_in_EUR = 0.86 / 1.087 ≈ 0.7912
    const result = await provider.getPrice("USD", "GBP");
    expect(result).not.toBeNull();
    expect(result!.price).toBeCloseTo(0.86 / 1.087, 3);
  });

  it("returns null when base currency not in ECB rates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => ECB_DAILY_XML,
      })
    );

    // BTC is not in ECB data
    const result = await provider.getPrice("BTC", "EUR");
    expect(result).toBeNull();
  });

  it("returns empty array on HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const results = await provider.getPrices("EUR");
    expect(results).toEqual([]);
  });
});

// ─── CoinGecko ────────────────────────────────────────────────────────────────

describe("CoinGeckoProvider", () => {
  const provider = new CoinGeckoProvider();

  it("parses current price correctly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ bitcoin: { eur: 85432.5 } }),
      })
    );

    const result = await provider.getPrice("bitcoin", "EUR");
    expect(result).not.toBeNull();
    expect(result!.symbol).toBe("bitcoin");
    expect(result!.price).toBeCloseTo(85432.5);
    expect(result!.currency).toBe("EUR");
    expect(result!.provider).toBe("coingecko");
  });

  it("returns null on HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const result = await provider.getPrice("bitcoin", "EUR");
    expect(result).toBeNull();
  });

  it("returns null when symbol not in response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ethereum: { eur: 3000 } }),
      })
    );
    const result = await provider.getPrice("bitcoin", "EUR");
    expect(result).toBeNull();
  });

  it("getPrices returns all currency pairs for a symbol", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ bitcoin: { eur: 85000, usd: 92000, gbp: 73000 } }),
      })
    );

    const results = await provider.getPrices("bitcoin");
    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results.find((r) => r.currency === "EUR")?.price).toBeCloseTo(85000);
    expect(results.find((r) => r.currency === "USD")?.price).toBeCloseTo(92000);
    expect(results.every((r) => r.symbol === "bitcoin")).toBe(true);
  });

  it("getPrices returns empty array on HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const results = await provider.getPrices("bitcoin");
    expect(results).toEqual([]);
  });
});

// ─── Alpha Vantage ────────────────────────────────────────────────────────────

describe("AlphaVantageProvider", () => {
  const provider = new AlphaVantageProvider("test-key");

  it("parses current price correctly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          "Global Quote": { "05. price": "150.25" },
        }),
      })
    );

    const result = await provider.getPrice("AAPL", "USD");
    expect(result).not.toBeNull();
    expect(result!.symbol).toBe("AAPL");
    expect(result!.price).toBeCloseTo(150.25);
    expect(result!.currency).toBe("USD");
    expect(result!.provider).toBe("alpha-vantage");
  });

  it("returns null on HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const result = await provider.getPrice("AAPL", "USD");
    expect(result).toBeNull();
  });

  it("getPriceRange returns daily prices in date range", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          "Time Series (Daily)": {
            "2026-01-15": { "4. close": "150.00" },
            "2026-01-14": { "4. close": "149.50" },
            "2026-01-13": { "4. close": "148.00" },
            "2026-01-10": { "4. close": "147.00" },
          },
        }),
      })
    );

    const results = await provider.getPriceRange("AAPL", "USD", "2026-01-13", "2026-01-15");
    expect(results).toHaveLength(3);
    expect(results[0].date).toBe("2026-01-13");
    expect(results[2].date).toBe("2026-01-15");
    expect(results[0].price).toBeCloseTo(148.0);
    expect(results.every((r) => r.provider === "alpha-vantage")).toBe(true);
  });

  it("getPriceRange excludes dates outside range", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          "Time Series (Daily)": {
            "2026-01-16": { "4. close": "151.00" },
            "2026-01-15": { "4. close": "150.00" },
            "2026-01-12": { "4. close": "146.00" },
          },
        }),
      })
    );

    const results = await provider.getPriceRange("AAPL", "USD", "2026-01-13", "2026-01-15");
    expect(results).toHaveLength(1);
    expect(results[0].date).toBe("2026-01-15");
  });

  it("getPriceRange returns empty on HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const results = await provider.getPriceRange("AAPL", "USD", "2026-01-13", "2026-01-15");
    expect(results).toEqual([]);
  });

  it("searchSymbol returns matching results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          bestMatches: [
            { "1. symbol": "AAPL", "2. name": "Apple Inc", "3. type": "Equity" },
            { "1. symbol": "AAPLX", "2. name": "Apple Fund", "3. type": "ETF" },
          ],
        }),
      })
    );

    const results = await provider.searchSymbol("apple");
    expect(results).toHaveLength(2);
    expect(results[0].symbol).toBe("AAPL");
    expect(results[0].type).toBe("equity");
  });
});

// ─── ECB Extended ─────────────────────────────────────────────────────────────

const ECB_HIST_XML = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01"
                 xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
  <Cube>
    <Cube time="2026-01-15">
      <Cube currency="USD" rate="1.0870"/>
      <Cube currency="GBP" rate="0.8600"/>
    </Cube>
    <Cube time="2026-01-14">
      <Cube currency="USD" rate="1.0850"/>
      <Cube currency="GBP" rate="0.8580"/>
    </Cube>
    <Cube time="2026-01-13">
      <Cube currency="USD" rate="1.0830"/>
      <Cube currency="GBP" rate="0.8560"/>
    </Cube>
  </Cube>
</gesmes:Envelope>`;

describe("EcbProvider — extended", () => {
  const provider = new EcbProvider();

  it("getPriceRange returns rates for date range", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => ECB_HIST_XML,
      })
    );

    const results = await provider.getPriceRange("EUR", "USD", "2026-01-13", "2026-01-15");
    expect(results).toHaveLength(3);
    expect(results[0].date).toBe("2026-01-13");
    expect(results[0].price).toBeCloseTo(1.083);
    expect(results[2].date).toBe("2026-01-15");
    expect(results[2].price).toBeCloseTo(1.087);
  });

  it("getPriceRange handles non-EUR base (USD→GBP)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => ECB_HIST_XML,
      })
    );

    const results = await provider.getPriceRange("USD", "GBP", "2026-01-14", "2026-01-15");
    expect(results).toHaveLength(2);
    // USD→GBP on 2026-01-15: 0.86 / 1.087
    expect(results[1].price).toBeCloseTo(0.86 / 1.087, 3);
  });

  it("getPriceRange returns empty on HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const results = await provider.getPriceRange("EUR", "USD", "2026-01-13", "2026-01-15");
    expect(results).toEqual([]);
  });

  it("searchSymbol finds currencies by code and name", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => ECB_DAILY_XML,
      })
    );

    const results = await provider.searchSymbol("USD");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.find((r) => r.symbol === "USD")).toBeTruthy();
    expect(results[0].type).toBe("currency");
  });

  it("searchSymbol returns empty on HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const results = await provider.searchSymbol("USD");
    expect(results).toEqual([]);
  });
});

// ─── Open Exchange Rates ─────────────────────────────────────────────────────

describe("OpenExchangeRatesProvider", () => {
  const provider = new OpenExchangeRatesProvider("test-key");

  it("parses getPrice response correctly via getPrices", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          timestamp: 1737000000,
          base: "USD",
          rates: { EUR: 0.92, GBP: 0.78, USD: 1 },
        }),
      })
    );

    const result = await provider.getPrice("EUR", "GBP");
    expect(result).not.toBeNull();
    expect(result!.symbol).toBe("EUR");
    expect(result!.currency).toBe("GBP");
    // EUR→GBP via USD pivot: GBP_rate / EUR_rate = 0.78 / 0.92
    expect(result!.price).toBeCloseTo(0.78 / 0.92, 3);
  });

  it("searchSymbol finds currencies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          EUR: "Euro",
          USD: "United States Dollar",
          GBP: "British Pound Sterling",
        }),
      })
    );

    const results = await provider.searchSymbol("euro");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.find((r) => r.symbol === "EUR")).toBeTruthy();
    expect(results[0].type).toBe("currency");
  });

  it("searchSymbol returns empty on HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const results = await provider.searchSymbol("USD");
    expect(results).toEqual([]);
  });

  it("getPriceRange fetches historical rates day by day", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        timestamp: 1737000000,
        base: "USD",
        rates: { EUR: 0.92, GBP: 0.78, USD: 1 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await provider.getPriceRange("EUR", "GBP", "2026-01-13", "2026-01-15");
    expect(results).toHaveLength(3);
    expect(results[0].date).toBe("2026-01-13");
    expect(results[2].date).toBe("2026-01-15");
    expect(results[0].price).toBeCloseTo(0.78 / 0.92, 3);
    // Should have made 3 fetch calls (one per day)
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
