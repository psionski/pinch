// ─── Provider Result Types ─────────────────────────────────────────────────────

export interface ExchangeRateResult {
  base: string;
  quote: string;
  rate: number;
  date: string; // YYYY-MM-DD
  provider: string;
}

export interface MarketPriceResult {
  symbol: string;
  price: number;
  currency: string;
  date: string; // YYYY-MM-DD
  provider: string;
}

// ─── Provider Interface ────────────────────────────────────────────────────────

export interface FinancialDataProvider {
  name: string;
  supportsExchangeRates: boolean;
  supportsMarketPrices: boolean;

  /** Fetch a single exchange rate. Returns null if unavailable. */
  getExchangeRate?(base: string, quote: string, date?: string): Promise<ExchangeRateResult | null>;

  /** Fetch all available rates for a base currency on a given date. */
  getExchangeRates?(base: string, date?: string): Promise<ExchangeRateResult[]>;

  /** Fetch price for a symbol. Returns null if unavailable. */
  getPrice?(symbol: string, currency: string, date?: string): Promise<MarketPriceResult | null>;

  /** Verify API key is valid and service is reachable. */
  healthCheck?(): Promise<boolean>;
}
