import type { ExchangeRateResult, FinancialDataProvider } from "./types";

const BASE_URL = "https://api.frankfurter.app";

/**
 * Frankfurter API provider.
 * Wraps ECB data with a clean REST JSON interface.
 * Free, no API key, historical data back to 1999.
 */
export class FrankfurterProvider implements FinancialDataProvider {
  readonly name = "frankfurter";
  readonly supportsExchangeRates = true;
  readonly supportsMarketPrices = false;

  async getExchangeRate(
    base: string,
    quote: string,
    date?: string
  ): Promise<ExchangeRateResult | null> {
    const endpoint = date ? `${BASE_URL}/${date}` : `${BASE_URL}/latest`;
    const url = `${endpoint}?from=${encodeURIComponent(base)}&to=${encodeURIComponent(quote)}`;

    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return null;

    const data = (await res.json()) as FrankfurterResponse;
    const rate = data.rates?.[quote];
    if (rate === undefined) return null;

    return {
      base,
      quote,
      rate,
      date: data.date,
      provider: this.name,
    };
  }

  async getExchangeRates(base: string, date?: string): Promise<ExchangeRateResult[]> {
    const endpoint = date ? `${BASE_URL}/${date}` : `${BASE_URL}/latest`;
    const url = `${endpoint}?from=${encodeURIComponent(base)}`;

    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return [];

    const data = (await res.json()) as FrankfurterResponse;
    if (!data.rates) return [];

    return Object.entries(data.rates).map(([quote, rate]) => ({
      base,
      quote,
      rate,
      date: data.date,
      provider: this.name,
    }));
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/latest?from=EUR&to=USD`, {
        next: { revalidate: 0 },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

interface FrankfurterResponse {
  date: string;
  base: string;
  rates: Record<string, number>;
}
