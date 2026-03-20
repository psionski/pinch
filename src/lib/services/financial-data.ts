import { and, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { exchangeRates, marketPrices } from "@/lib/db/schema";
import type {
  FinancialDataProvider,
  ExchangeRateResult,
  MarketPriceResult,
} from "@/lib/providers/types";
import type { SettingsService } from "./settings";
import { EcbProvider } from "@/lib/providers/ecb";
import { FrankfurterProvider } from "@/lib/providers/frankfurter";
import { OpenExchangeRatesProvider } from "@/lib/providers/open-exchange-rates";
import { CoinGeckoProvider } from "@/lib/providers/coingecko";
import { AlphaVantageProvider } from "@/lib/providers/alpha-vantage";

type Db = BetterSQLite3Database<typeof schema>;

// ─── TTL Configuration ────────────────────────────────────────────────────────

/** Staleness window for current-day exchange rates (milliseconds). */
const EXCHANGE_RATE_TTL_MS = 60 * 60 * 1000; // 1 hour
/** Staleness window for current-day market prices (milliseconds). */
const MARKET_PRICE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// ─── Result Types ─────────────────────────────────────────────────────────────

export interface ConvertResult {
  converted: number;
  rate: number;
  date: string;
  provider: string;
  stale: boolean;
}

export interface ProviderStatus {
  name: string;
  type: "exchange-rates" | "market-prices" | "both";
  apiKeyRequired: boolean;
  apiKeySet: boolean;
  healthy: boolean | null; // null = not checked yet
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class FinancialDataService {
  private db: Db;
  private settings: SettingsService;

  constructor(db: Db, settings: SettingsService) {
    this.db = db;
    this.settings = settings;
  }

  // ─── Exchange Rates ────────────────────────────────────────────────────────

  /**
   * Get an exchange rate for a currency pair on a date.
   * Cache-first: returns cached value if fresh. Falls back to stale cache if all providers fail.
   */
  async getExchangeRate(
    base: string,
    quote: string,
    date?: string
  ): Promise<(ExchangeRateResult & { stale: boolean }) | null> {
    const rateDate = date ?? isoToday();
    const isHistorical = rateDate < isoToday();

    // Check cache
    const cached = this.getCachedRate(base, quote, rateDate);
    if (cached) {
      const age = Date.now() - new Date(cached.fetchedAt).getTime();
      if (isHistorical || age < EXCHANGE_RATE_TTL_MS) {
        return { ...toExchangeRateResult(cached), stale: false };
      }
    }

    // Try providers
    const providers = this.buildExchangeRateProviders();
    for (const provider of providers) {
      try {
        const result = await provider.getExchangeRate?.(base, quote, rateDate);
        if (result) {
          this.cacheRate(result);
          return { ...result, stale: false };
        }
      } catch {
        // continue to next provider
      }
    }

    // Return stale cached value if available
    if (cached) {
      return { ...toExchangeRateResult(cached), stale: true };
    }

    return null;
  }

  /**
   * Get all available exchange rates for a base currency on a date.
   */
  async getExchangeRates(
    base: string,
    date?: string
  ): Promise<(ExchangeRateResult & { stale: boolean })[]> {
    const rateDate = date ?? isoToday();
    const isHistorical = rateDate < isoToday();

    // Check cache for existing rates on this date
    const cached = this.getCachedRatesForBase(base, rateDate);
    if (cached.length > 0) {
      const oldestFetch = Math.min(...cached.map((r) => new Date(r.fetchedAt).getTime()));
      const age = Date.now() - oldestFetch;
      if (isHistorical || age < EXCHANGE_RATE_TTL_MS) {
        return cached.map((r) => ({ ...toExchangeRateResult(r), stale: false }));
      }
    }

    // Try providers
    const providers = this.buildExchangeRateProviders();
    for (const provider of providers) {
      try {
        const results = await provider.getExchangeRates?.(base, rateDate);
        if (results && results.length > 0) {
          for (const r of results) this.cacheRate(r);
          return results.map((r) => ({ ...r, stale: false }));
        }
      } catch {
        // continue to next provider
      }
    }

    // Return stale cached values if available
    if (cached.length > 0) {
      return cached.map((r) => ({ ...toExchangeRateResult(r), stale: true }));
    }

    return [];
  }

  /**
   * Convert an amount (in cents) from one currency to another.
   * Returns the converted amount in cents.
   */
  async convert(
    amountCents: number,
    from: string,
    to: string,
    date?: string
  ): Promise<ConvertResult | null> {
    if (from === to) {
      return {
        converted: amountCents,
        rate: 1,
        date: date ?? isoToday(),
        provider: "none",
        stale: false,
      };
    }

    const rateResult = await this.getExchangeRate(from, to, date);
    if (!rateResult) return null;

    return {
      converted: Math.round(amountCents * rateResult.rate),
      rate: rateResult.rate,
      date: rateResult.date,
      provider: rateResult.provider,
      stale: rateResult.stale,
    };
  }

  // ─── Market Prices ─────────────────────────────────────────────────────────

  /**
   * Get a market price for a symbol in a given currency on a date.
   * Cache-first with TTL. Falls back to stale cache if providers fail.
   */
  async getMarketPrice(
    symbol: string,
    currency = "EUR",
    date?: string
  ): Promise<(MarketPriceResult & { stale: boolean }) | null> {
    const priceDate = date ?? isoToday();
    const isHistorical = priceDate < isoToday();
    const currencyUpper = currency.toUpperCase();

    const cached = this.getCachedPrice(symbol, currencyUpper, priceDate);
    if (cached) {
      const age = Date.now() - new Date(cached.fetchedAt).getTime();
      if (isHistorical || age < MARKET_PRICE_TTL_MS) {
        return { ...toMarketPriceResult(cached), stale: false };
      }
    }

    const providers = this.buildMarketPriceProviders();
    for (const provider of providers) {
      try {
        const result = await provider.getPrice?.(symbol, currencyUpper, priceDate);
        if (result) {
          this.cachePriceResult(result);
          return { ...result, stale: false };
        }
      } catch {
        // continue to next provider
      }
    }

    if (cached) {
      return { ...toMarketPriceResult(cached), stale: true };
    }

    return null;
  }

  // ─── Provider Management ───────────────────────────────────────────────────

  /** Store an API key for a provider. */
  setApiKey(provider: string, key: string): void {
    this.settings.set(`provider.${provider}.key`, key);
  }

  /** Retrieve the API key for a provider. Returns null if not set. */
  getApiKey(provider: string): string | null {
    return this.settings.get(`provider.${provider}.key`);
  }

  /** List all known providers with their status. */
  async getProviderStatus(): Promise<ProviderStatus[]> {
    const oerKey = this.getApiKey("open-exchange-rates");
    const cgKey = this.getApiKey("coingecko");
    const avKey = this.getApiKey("alpha-vantage");

    const statuses: ProviderStatus[] = [
      {
        name: "frankfurter",
        type: "exchange-rates",
        apiKeyRequired: false,
        apiKeySet: true,
        healthy: null,
      },
      {
        name: "ecb",
        type: "exchange-rates",
        apiKeyRequired: false,
        apiKeySet: true,
        healthy: null,
      },
      {
        name: "open-exchange-rates",
        type: "exchange-rates",
        apiKeyRequired: true,
        apiKeySet: !!oerKey,
        healthy: null,
      },
      {
        name: "coingecko",
        type: "market-prices",
        apiKeyRequired: false,
        apiKeySet: true,
        healthy: null,
      },
      {
        name: "alpha-vantage",
        type: "market-prices",
        apiKeyRequired: true,
        apiKeySet: !!avKey,
        healthy: null,
      },
    ];

    // Run health checks in parallel
    const checks = await Promise.allSettled([
      new FrankfurterProvider().healthCheck!(),
      new EcbProvider().healthCheck!(),
      oerKey ? new OpenExchangeRatesProvider(oerKey).healthCheck!() : Promise.resolve(false),
      new CoinGeckoProvider(cgKey ?? undefined).healthCheck!(),
      avKey ? new AlphaVantageProvider(avKey).healthCheck!() : Promise.resolve(false),
    ]);

    checks.forEach((result, i) => {
      statuses[i].healthy = result.status === "fulfilled" ? result.value : false;
    });

    return statuses;
  }

  // ─── Cache Helpers ─────────────────────────────────────────────────────────

  private getCachedRate(
    base: string,
    quote: string,
    date: string
  ): typeof schema.exchangeRates.$inferSelect | null {
    return (
      this.db
        .select()
        .from(exchangeRates)
        .where(
          and(
            eq(exchangeRates.base, base),
            eq(exchangeRates.quote, quote),
            eq(exchangeRates.date, date)
          )
        )
        .get() ?? null
    );
  }

  private getCachedRatesForBase(
    base: string,
    date: string
  ): (typeof schema.exchangeRates.$inferSelect)[] {
    return this.db
      .select()
      .from(exchangeRates)
      .where(and(eq(exchangeRates.base, base), eq(exchangeRates.date, date)))
      .all();
  }

  private cacheRate(result: ExchangeRateResult): void {
    this.db
      .insert(exchangeRates)
      .values({
        base: result.base,
        quote: result.quote,
        rate: String(result.rate),
        date: result.date,
        provider: result.provider,
      })
      .onConflictDoUpdate({
        target: [exchangeRates.base, exchangeRates.quote, exchangeRates.date],
        set: {
          rate: String(result.rate),
          provider: result.provider,
          fetchedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
        },
      })
      .run();
  }

  private getCachedPrice(
    symbol: string,
    currency: string,
    date: string
  ): typeof schema.marketPrices.$inferSelect | null {
    return (
      this.db
        .select()
        .from(marketPrices)
        .where(
          and(
            eq(marketPrices.symbol, symbol),
            eq(marketPrices.currency, currency),
            eq(marketPrices.date, date)
          )
        )
        .get() ?? null
    );
  }

  private cachePriceResult(result: MarketPriceResult): void {
    this.db
      .insert(marketPrices)
      .values({
        symbol: result.symbol,
        price: String(result.price),
        currency: result.currency,
        date: result.date,
        provider: result.provider,
      })
      .onConflictDoUpdate({
        target: [marketPrices.symbol, marketPrices.currency, marketPrices.date],
        set: {
          price: String(result.price),
          provider: result.provider,
          fetchedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
        },
      })
      .run();
  }

  // ─── Provider Builders ─────────────────────────────────────────────────────

  protected buildExchangeRateProviders(): FinancialDataProvider[] {
    const providers: FinancialDataProvider[] = [new FrankfurterProvider(), new EcbProvider()];
    const oerKey = this.getApiKey("open-exchange-rates");
    if (oerKey) providers.push(new OpenExchangeRatesProvider(oerKey));
    return providers;
  }

  protected buildMarketPriceProviders(): FinancialDataProvider[] {
    const cgKey = this.getApiKey("coingecko") ?? undefined;
    const providers: FinancialDataProvider[] = [new CoinGeckoProvider(cgKey)];
    const avKey = this.getApiKey("alpha-vantage");
    if (avKey) providers.push(new AlphaVantageProvider(avKey));
    return providers;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function toExchangeRateResult(row: typeof schema.exchangeRates.$inferSelect): ExchangeRateResult {
  return {
    base: row.base,
    quote: row.quote,
    rate: parseFloat(row.rate),
    date: row.date,
    provider: row.provider,
  };
}

function toMarketPriceResult(row: typeof schema.marketPrices.$inferSelect): MarketPriceResult {
  return {
    symbol: row.symbol,
    price: parseFloat(row.price),
    currency: row.currency,
    date: row.date,
    provider: row.provider,
  };
}

// Re-export for convenience
export type { ExchangeRateResult, MarketPriceResult };
