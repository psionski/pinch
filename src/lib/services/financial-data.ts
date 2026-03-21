import { and, eq, gte, lte } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { marketPrices } from "@/lib/db/schema";
import type { FinancialDataProvider, PriceResult, SymbolSearchResult } from "@/lib/providers/types";
import type { SettingsService } from "./settings";
import { EcbProvider } from "@/lib/providers/ecb";
import { FrankfurterProvider } from "@/lib/providers/frankfurter";
import { OpenExchangeRatesProvider } from "@/lib/providers/open-exchange-rates";
import { CoinGeckoProvider } from "@/lib/providers/coingecko";
import { AlphaVantageProvider } from "@/lib/providers/alpha-vantage";
import { financialLogger } from "@/lib/logger";

type Db = BetterSQLite3Database<typeof schema>;

// ─── TTL Configuration ────────────────────────────────────────────────────────

/** Staleness window for current-day prices (milliseconds). */
const PRICE_TTL_MS = 15 * 60 * 1000; // 15 minutes

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
  healthy: boolean | null;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class FinancialDataService {
  private db: Db;
  private settings: SettingsService;

  constructor(db: Db, settings: SettingsService) {
    this.db = db;
    this.settings = settings;
  }

  // ─── Unified Price Lookup ─────────────────────────────────────────────────

  /**
   * Get a price for a symbol in a given currency on a date.
   * Works for both market assets (crypto, stocks) and exchange rates (currencies).
   * Cache-first: returns cached value if fresh. Falls back to stale cache if all providers fail.
   */
  async getPrice(
    symbol: string,
    currency: string,
    date?: string
  ): Promise<(PriceResult & { stale: boolean }) | null> {
    const priceDate = date ?? isoToday();
    const isHistorical = priceDate < isoToday();

    const cached = this.getCachedPrice(symbol, currency, priceDate);
    if (cached) {
      const age = Date.now() - new Date(cached.fetchedAt).getTime();
      if (isHistorical || age < PRICE_TTL_MS) {
        financialLogger.debug({ symbol, currency, date: priceDate }, "Price served from cache");
        return { ...toPriceResult(cached), stale: false };
      }
    }

    const providers = this.buildAllProviders();
    for (const provider of providers) {
      try {
        const result = await provider.getPrice?.(symbol, currency, priceDate);
        if (result) {
          financialLogger.info(
            { provider: result.provider, symbol, currency, date: priceDate },
            "External price fetched"
          );
          this.cachePrice({ ...result, date: priceDate });
          return { ...result, stale: false };
        }
      } catch (err) {
        financialLogger.warn(
          { provider: provider.name, symbol, currency, date: priceDate, err },
          "Provider price lookup failed"
        );
      }
    }

    if (cached) {
      financialLogger.warn(
        { symbol, currency, date: priceDate },
        "All providers failed, returning stale cache"
      );
      return { ...toPriceResult(cached), stale: true };
    }

    financialLogger.warn(
      { symbol, currency, date: priceDate },
      "All providers failed, no cached data"
    );
    return null;
  }

  /**
   * Get all available prices/rates for a symbol on a date.
   * Primarily useful for exchange rates (e.g. all pairs for "EUR").
   */
  async getPrices(symbol: string, date?: string): Promise<(PriceResult & { stale: boolean })[]> {
    const priceDate = date ?? isoToday();
    const isHistorical = priceDate < isoToday();

    const cached = this.getCachedPricesForSymbol(symbol, priceDate);
    if (cached.length > 0) {
      const oldestFetch = Math.min(...cached.map((r) => new Date(r.fetchedAt).getTime()));
      const age = Date.now() - oldestFetch;
      if (isHistorical || age < PRICE_TTL_MS) {
        financialLogger.debug(
          { symbol, date: priceDate, count: cached.length },
          "Prices served from cache"
        );
        return cached.map((r) => ({ ...toPriceResult(r), stale: false }));
      }
    }

    const providers = this.buildAllProviders();
    for (const provider of providers) {
      try {
        const results = await provider.getPrices?.(symbol, priceDate);
        if (results && results.length > 0) {
          financialLogger.info(
            { provider: provider.name, symbol, date: priceDate, count: results.length },
            "External prices fetched"
          );
          for (const r of results) this.cachePrice({ ...r, date: priceDate });
          return results.map((r) => ({ ...r, stale: false }));
        }
      } catch (err) {
        financialLogger.warn(
          { provider: provider.name, symbol, date: priceDate, err },
          "Provider prices lookup failed"
        );
      }
    }

    if (cached.length > 0) {
      financialLogger.warn(
        { symbol, date: priceDate },
        "All providers failed, returning stale prices"
      );
      return cached.map((r) => ({ ...toPriceResult(r), stale: true }));
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

    const rateResult = await this.getPrice(from, to, date);
    if (!rateResult) return null;

    return {
      converted: Math.round(amountCents * rateResult.price),
      rate: rateResult.price,
      date: rateResult.date,
      provider: rateResult.provider,
      stale: rateResult.stale,
    };
  }

  // ─── Range Backfill ────────────────────────────────────────────────────────

  /**
   * Ensure market_prices has data for (symbol, currency) over [from, to].
   * Checks which dates are cached and fetches only missing segments.
   * Idempotent — safe to call multiple times for the same range.
   */
  async ensurePriceHistory(
    symbol: string,
    currency: string,
    from: string,
    to: string
  ): Promise<void> {
    const cached = this.db
      .select({ date: marketPrices.date })
      .from(marketPrices)
      .where(
        and(
          eq(marketPrices.symbol, symbol),
          eq(marketPrices.currency, currency),
          gte(marketPrices.date, from),
          lte(marketPrices.date, to)
        )
      )
      .all();

    const cachedDates = new Set(cached.map((r) => r.date));

    const expectedDays = daysBetween(from, to);
    if (expectedDays > 0 && cachedDates.size / expectedDays > 0.8) return;

    financialLogger.debug({ symbol, currency, from, to }, "Backfilling price history");

    const providers = this.buildAllProviders();
    for (const provider of providers) {
      try {
        const results = await provider.getPriceRange?.(symbol, currency, from, to);
        if (results && results.length > 0) {
          let inserted = 0;
          for (const r of results) {
            if (!cachedDates.has(r.date)) {
              this.cachePrice(r);
              inserted++;
            }
          }
          financialLogger.info(
            { provider: provider.name, symbol, currency, from, to, inserted },
            "Price history backfilled"
          );
          return;
        }
      } catch (err) {
        financialLogger.warn(
          { provider: provider.name, symbol, currency, from, to, err },
          "Provider price range lookup failed"
        );
      }
    }
  }

  // ─── Symbol Search ────────────────────────────────────────────────────────

  /**
   * Search for market symbols across all providers.
   */
  async searchSymbol(query: string): Promise<SymbolSearchResult[]> {
    const providers = this.buildAllProviders();
    const results: SymbolSearchResult[] = [];

    const searches = providers
      .filter((p) => p.searchSymbol)
      .map(async (p) => {
        try {
          const matches = await p.searchSymbol!(query);
          results.push(...matches);
        } catch (err) {
          financialLogger.warn({ provider: p.name, query, err }, "Symbol search provider failed");
        }
      });

    await Promise.allSettled(searches);
    financialLogger.info({ query, resultCount: results.length }, "Symbol search completed");
    return results;
  }

  // ─── Provider Management ───────────────────────────────────────────────────

  setApiKey(provider: string, key: string): void {
    this.settings.set(`provider.${provider}.key`, key);
  }

  getApiKey(provider: string): string | null {
    return this.settings.get(`provider.${provider}.key`);
  }

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

    financialLogger.debug(
      { providers: statuses.map((s) => ({ name: s.name, healthy: s.healthy })) },
      "Provider health check completed"
    );
    return statuses;
  }

  // ─── Cache Helpers ─────────────────────────────────────────────────────────

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

  private getCachedPricesForSymbol(
    symbol: string,
    date: string
  ): (typeof schema.marketPrices.$inferSelect)[] {
    return this.db
      .select()
      .from(marketPrices)
      .where(and(eq(marketPrices.symbol, symbol), eq(marketPrices.date, date)))
      .all();
  }

  private cachePrice(result: PriceResult): void {
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

  protected buildAllProviders(): FinancialDataProvider[] {
    const cgKey = this.getApiKey("coingecko") ?? undefined;
    const providers: FinancialDataProvider[] = [
      new FrankfurterProvider(),
      new EcbProvider(),
      new CoinGeckoProvider(cgKey),
    ];
    const oerKey = this.getApiKey("open-exchange-rates");
    if (oerKey) providers.push(new OpenExchangeRatesProvider(oerKey));
    const avKey = this.getApiKey("alpha-vantage");
    if (avKey) providers.push(new AlphaVantageProvider(avKey));
    return providers;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function toPriceResult(row: typeof schema.marketPrices.$inferSelect): PriceResult {
  return {
    symbol: row.symbol,
    price: parseFloat(row.price),
    currency: row.currency,
    date: row.date,
    provider: row.provider,
  };
}

function daysBetween(from: string, to: string): number {
  const a = new Date(from + "T00:00:00Z");
  const b = new Date(to + "T00:00:00Z");
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

// Re-export for convenience
export type { PriceResult };
