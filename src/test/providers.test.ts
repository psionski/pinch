// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import { FrankfurterProvider } from "@/lib/providers/frankfurter";
import { EcbProvider } from "@/lib/providers/ecb";
import { CoinGeckoProvider } from "@/lib/providers/coingecko";

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Frankfurter ──────────────────────────────────────────────────────────────

describe("FrankfurterProvider", () => {
  const provider = new FrankfurterProvider();

  it("parses getExchangeRate response correctly", async () => {
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

    const result = await provider.getExchangeRate("USD", "EUR", "2026-01-15");
    expect(result).not.toBeNull();
    expect(result!.base).toBe("USD");
    expect(result!.quote).toBe("EUR");
    expect(result!.rate).toBeCloseTo(0.92);
    expect(result!.date).toBe("2026-01-15");
    expect(result!.provider).toBe("frankfurter");
  });

  it("returns null on HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const result = await provider.getExchangeRate("USD", "EUR");
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
    const result = await provider.getExchangeRate("USD", "EUR");
    expect(result).toBeNull();
  });

  it("getExchangeRates returns all pairs for a base", async () => {
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

    const results = await provider.getExchangeRates("EUR");
    expect(results).toHaveLength(3);
    expect(results.map((r) => r.quote).sort()).toEqual(["GBP", "JPY", "USD"]);
    expect(results.every((r) => r.base === "EUR")).toBe(true);
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

    const result = await provider.getExchangeRate("EUR", "USD");
    expect(result).not.toBeNull();
    expect(result!.base).toBe("EUR");
    expect(result!.quote).toBe("USD");
    expect(result!.rate).toBeCloseTo(1.087);
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
    const result = await provider.getExchangeRate("USD", "GBP");
    expect(result).not.toBeNull();
    expect(result!.rate).toBeCloseTo(0.86 / 1.087, 3);
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
    const result = await provider.getExchangeRate("BTC", "EUR");
    expect(result).toBeNull();
  });

  it("returns empty array on HTTP error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const results = await provider.getExchangeRates("EUR");
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
});
