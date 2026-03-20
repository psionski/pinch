import type { MarketPriceResult, FinancialDataProvider } from "./types";

const BASE_URL = "https://api.coingecko.com/api/v3";
const PRO_URL = "https://pro-api.coingecko.com/api/v3";

/**
 * CoinGecko provider for crypto prices.
 * Free tier: ~30 req/min, no API key required.
 * Optional pro key for higher rate limits.
 */
export class CoinGeckoProvider implements FinancialDataProvider {
  readonly name = "coingecko";
  readonly supportsExchangeRates = false;
  readonly supportsMarketPrices = true;

  private baseUrl: string;

  constructor(private apiKey?: string) {
    this.baseUrl = apiKey ? PRO_URL : BASE_URL;
  }

  async getPrice(
    symbol: string,
    currency = "eur",
    date?: string
  ): Promise<MarketPriceResult | null> {
    const vs = currency.toLowerCase();

    if (date && date < today()) {
      return this.getHistoricalPrice(symbol, vs, date);
    }

    return this.getCurrentPrice(symbol, vs);
  }

  private async getCurrentPrice(symbol: string, vs: string): Promise<MarketPriceResult | null> {
    const url = new URL(`${this.baseUrl}/simple/price`);
    url.searchParams.set("ids", symbol);
    url.searchParams.set("vs_currencies", vs);
    if (this.apiKey) url.searchParams.set("x_cg_pro_api_key", this.apiKey);

    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    if (!res.ok) return null;

    const data = (await res.json()) as Record<string, Record<string, number>>;
    const price = data[symbol]?.[vs];
    if (price === undefined) return null;

    return {
      symbol,
      price,
      currency: vs.toUpperCase(),
      date: today(),
      provider: this.name,
    };
  }

  private async getHistoricalPrice(
    symbol: string,
    vs: string,
    date: string
  ): Promise<MarketPriceResult | null> {
    // CoinGecko historical endpoint uses DD-MM-YYYY format
    const [y, mo, d] = date.split("-");
    const cgDate = `${d}-${mo}-${y}`;

    const url = new URL(`${this.baseUrl}/coins/${symbol}/history`);
    url.searchParams.set("date", cgDate);
    url.searchParams.set("localization", "false");
    if (this.apiKey) url.searchParams.set("x_cg_pro_api_key", this.apiKey);

    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    if (!res.ok) return null;

    const data = (await res.json()) as CoinGeckoHistoryResponse;
    const price = data.market_data?.current_price?.[vs];
    if (price === undefined) return null;

    return {
      symbol,
      price,
      currency: vs.toUpperCase(),
      date,
      provider: this.name,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/ping${this.apiKey ? `?x_cg_pro_api_key=${this.apiKey}` : ""}`;
      const res = await fetch(url, { next: { revalidate: 0 } });
      return res.ok;
    } catch {
      return false;
    }
  }
}

interface CoinGeckoHistoryResponse {
  market_data?: {
    current_price?: Record<string, number>;
  };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
