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

  /** Fetch daily prices for a symbol over a date range. */
  getPriceRange?(
    symbol: string,
    currency: string,
    from: string,
    to: string
  ): Promise<MarketPriceResult[]>;

  /** Fetch exchange rates for a pair over a date range. */
  getExchangeRateRange?(
    base: string,
    quote: string,
    from: string,
    to: string
  ): Promise<ExchangeRateResult[]>;

  /** Search for a symbol by name/query. Returns matching symbols for auto-discovery. */
  searchSymbol?(query: string): Promise<SymbolSearchResult[]>;

  /** Verify API key is valid and service is reachable. */
  healthCheck?(): Promise<boolean>;
}

export interface SymbolSearchResult {
  provider: string;
  symbol: string;
  name: string;
  type?: string; // "crypto", "stock", "etf", etc.
}
