import type { ExchangeRateResult, FinancialDataProvider } from "./types";

const BASE_URL = "https://openexchangerates.org/api";

/**
 * Open Exchange Rates provider.
 * Real-time rates, 170+ currencies. Requires a free-tier API key.
 * Free tier: 1,000 req/month, base currency locked to USD.
 */
export class OpenExchangeRatesProvider implements FinancialDataProvider {
  readonly name = "open-exchange-rates";
  readonly supportsExchangeRates = true;
  readonly supportsMarketPrices = false;

  constructor(private apiKey: string) {}

  async getExchangeRate(
    base: string,
    quote: string,
    date?: string
  ): Promise<ExchangeRateResult | null> {
    const rates = await this.getExchangeRates(base, date);
    return rates.find((r) => r.quote === quote) ?? null;
  }

  async getExchangeRates(base: string, date?: string): Promise<ExchangeRateResult[]> {
    // Free tier only supports USD as base; use USD as pivot
    const url = date
      ? `${BASE_URL}/historical/${date}.json?app_id=${this.apiKey}&base=USD`
      : `${BASE_URL}/latest.json?app_id=${this.apiKey}&base=USD`;

    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return [];

    const data = (await res.json()) as OerResponse;
    if (!data.rates) return [];

    // OER returns USD-based rates. Convert to requested base.
    const usdRates = new Map(Object.entries(data.rates));
    usdRates.set("USD", 1);

    const baseRate = usdRates.get(base);
    if (baseRate === undefined) return [];

    const rateDate = date ?? isoDate(data.timestamp * 1000);
    const results: ExchangeRateResult[] = [];

    for (const [currency, usdRate] of usdRates) {
      if (currency === base) continue;
      results.push({
        base,
        quote: currency,
        rate: usdRate / baseRate,
        date: rateDate,
        provider: this.name,
      });
    }

    return results;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/latest.json?app_id=${this.apiKey}&symbols=EUR`, {
        next: { revalidate: 0 },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

interface OerResponse {
  timestamp: number;
  base: string;
  rates: Record<string, number>;
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
