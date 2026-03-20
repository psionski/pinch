import type { MarketPriceResult, FinancialDataProvider } from "./types";

const BASE_URL = "https://www.alphavantage.co/query";

/**
 * Alpha Vantage provider for stock and ETF prices.
 * Free tier: 25 req/day. Requires an API key (free to register).
 * Prices returned in USD; conversion needed for EUR display.
 */
export class AlphaVantageProvider implements FinancialDataProvider {
  readonly name = "alpha-vantage";
  readonly supportsExchangeRates = false;
  readonly supportsMarketPrices = true;

  constructor(private apiKey: string) {}

  async getPrice(
    symbol: string,
    currency = "USD",
    date?: string
  ): Promise<MarketPriceResult | null> {
    if (date && date < today()) {
      return this.getHistoricalPrice(symbol, currency, date);
    }
    return this.getCurrentPrice(symbol, currency);
  }

  private async getCurrentPrice(
    symbol: string,
    currency: string
  ): Promise<MarketPriceResult | null> {
    const url = new URL(BASE_URL);
    url.searchParams.set("function", "GLOBAL_QUOTE");
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("apikey", this.apiKey);

    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    if (!res.ok) return null;

    const data = (await res.json()) as AlphaVantageQuoteResponse;
    const priceStr = data["Global Quote"]?.["05. price"];
    if (!priceStr) return null;

    const price = parseFloat(priceStr);
    if (isNaN(price)) return null;

    // Alpha Vantage returns USD prices; note currency may not match
    return {
      symbol,
      price,
      currency: currency.toUpperCase(),
      date: today(),
      provider: this.name,
    };
  }

  private async getHistoricalPrice(
    symbol: string,
    currency: string,
    date: string
  ): Promise<MarketPriceResult | null> {
    const url = new URL(BASE_URL);
    url.searchParams.set("function", "TIME_SERIES_DAILY");
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("outputsize", "compact");
    url.searchParams.set("apikey", this.apiKey);

    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    if (!res.ok) return null;

    const data = (await res.json()) as AlphaVantageDailyResponse;
    const series = data["Time Series (Daily)"];
    if (!series) return null;

    // Find closest date on or before requested
    const availableDates = Object.keys(series).sort().reverse();
    const closestDate = availableDates.find((d) => d <= date);
    if (!closestDate) return null;

    const closeStr = series[closestDate]?.["4. close"];
    if (!closeStr) return null;

    const price = parseFloat(closeStr);
    if (isNaN(price)) return null;

    return {
      symbol,
      price,
      currency: currency.toUpperCase(),
      date: closestDate,
      provider: this.name,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const url = new URL(BASE_URL);
      url.searchParams.set("function", "GLOBAL_QUOTE");
      url.searchParams.set("symbol", "IBM");
      url.searchParams.set("apikey", this.apiKey);
      const res = await fetch(url.toString(), { next: { revalidate: 0 } });
      if (!res.ok) return false;
      const data = (await res.json()) as Record<string, unknown>;
      return "Global Quote" in data;
    } catch {
      return false;
    }
  }
}

interface AlphaVantageQuoteResponse {
  "Global Quote"?: Record<string, string>;
}

interface AlphaVantageDailyResponse {
  "Time Series (Daily)"?: Record<string, Record<string, string>>;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
