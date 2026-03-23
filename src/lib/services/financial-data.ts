import { Temporal } from "@js-temporal/polyfill";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { marketPrices } from "@/lib/db/schema";
import type {
  FinancialDataProvider,
  PriceResult,
  SymbolSearchResult,
  ProviderName,
} from "@/lib/providers/types";
import type { SymbolMap } from "@/lib/validators/assets";
import type { SettingsService } from "./settings";
import { getProvider } from "@/lib/providers/registry";
import { financialLogger } from "@/lib/logger";
import { isoToday, daysBetween, normalizeUtc, offsetDate } from "@/lib/date-ranges";

type Db = BetterSQLite3Database<typeof schema>;

// ─── TTL Configuration ────────────────────────────────────────────────────────

/** Staleness window for current-day prices (milliseconds). */
const PRICE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/** Lookback window for cache queries (days). Covers weekends/holidays. */
const CACHE_LOOKBACK_DAYS = 7;

// ─── Result Types ─────────────────────────────────────────────────────────────

export interface ConvertResult {
  converted: number;
  rate: number;
  date: string;
  provider: ProviderName;
  stale: boolean;
}

export interface ProviderStatus {
  name: ProviderName;
  type: "exchange-rates" | "market-prices" | "both";
  apiKeyRequired: boolean;
  apiKeySet: boolean;
  healthy: boolean | null;
}

/** Factory type for instantiating providers by name. Used for DI in tests. */
export type ProviderFactory = (name: ProviderName) => FinancialDataProvider | null;

// ─── Shared Cache Helpers ─────────────────────────────────────────────────────

type MarketPriceRow = typeof schema.marketPrices.$inferSelect;

/**
 * Find a cached price in market_prices with a 7-day lookback window.
 * No provider filter — cache key is (symbol, currency, date).
 */
export function findCachedPrice(
  db: Db,
  symbol: string,
  currency: string,
  date: string
): MarketPriceRow | null {
  const weekBefore = offsetDate(date, -CACHE_LOOKBACK_DAYS);

  return (
    db
      .select()
      .from(marketPrices)
      .where(
        and(
          eq(marketPrices.symbol, symbol),
          eq(marketPrices.currency, currency),
          gte(marketPrices.date, weekBefore),
          lte(marketPrices.date, date)
        )
      )
      .orderBy(desc(marketPrices.date))
      .limit(1)
      .get() ?? null
  );
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class FinancialDataService {
  private db: Db;
  private settings: SettingsService;
  private factory: ProviderFactory;

  constructor(db: Db, settings: SettingsService, factory?: ProviderFactory) {
    this.db = db;
    this.settings = settings;
    this.factory = factory ?? ((name) => getProvider(name, this.settings));
  }

  // ─── Unified Price Lookup ─────────────────────────────────────────────────

  /**
   * Get a price for a symbolMap in a given currency on a date.
   * Iterates symbolMap entries, checking cache then calling each provider.
   * Falls back to stale cache if all providers fail.
   */
  async getPrice(
    symbolMap: SymbolMap,
    currency: string,
    date?: string
  ): Promise<(PriceResult & { stale: boolean }) | null> {
    const priceDate = date ?? isoToday();
    const isHistorical = priceDate < isoToday();
    const entries = symbolMapEntries(symbolMap);

    // Phase 1: check cache for each symbol
    let staleEntry: MarketPriceRow | null = null;
    for (const [, symbol] of entries) {
      if (symbol === currency) continue;
      const cached = findCachedPrice(this.db, symbol, currency, priceDate);
      if (cached) {
        const age =
          Date.now() - Temporal.Instant.from(normalizeUtc(cached.fetchedAt)).epochMilliseconds;
        if (isHistorical || age < PRICE_TTL_MS) {
          financialLogger.debug({ symbol, currency, date: priceDate }, "Price served from cache");
          return { ...toPriceResult(cached), stale: false };
        }
        staleEntry ??= cached;
      }
    }

    // Phase 2: try each provider
    for (const [providerName, symbol] of entries) {
      if (symbol === currency) continue;
      const provider = this.factory(providerName);
      if (!provider) continue;

      try {
        const result = await provider.getPrice?.(symbol, currency, priceDate);
        if (result) {
          financialLogger.info(
            { provider: providerName, symbol, currency, date: priceDate },
            "External price fetched"
          );
          this.cachePrice({ ...result, date: priceDate });
          return { ...result, date: priceDate, stale: false };
        }
      } catch (err) {
        financialLogger.warn(
          { provider: providerName, symbol, currency, date: priceDate, err },
          "Provider price lookup failed"
        );
      }
    }

    // Phase 3: stale fallback
    if (staleEntry) {
      financialLogger.warn(
        { symbol: staleEntry.symbol, currency, date: priceDate },
        "All providers failed, returning stale cache"
      );
      return { ...toPriceResult(staleEntry), stale: true };
    }

    financialLogger.warn({ currency, date: priceDate }, "All providers failed, no cached data");
    return null;
  }

  /**
   * Get all available prices/rates for a symbolMap on a date.
   * Tries each provider's getPrices and returns the first success.
   */
  async getPrices(
    symbolMap: SymbolMap,
    date?: string
  ): Promise<(PriceResult & { stale: boolean })[]> {
    const priceDate = date ?? isoToday();
    const entries = symbolMapEntries(symbolMap);

    for (const [providerName, symbol] of entries) {
      const provider = this.factory(providerName);
      if (!provider?.getPrices) continue;

      try {
        const results = await provider.getPrices(symbol, priceDate);
        if (results.length > 0) {
          financialLogger.info(
            { provider: providerName, symbol, date: priceDate, count: results.length },
            "External prices fetched"
          );
          for (const r of results) this.cachePrice({ ...r, date: priceDate });
          return results.map((r) => ({ ...r, stale: false }));
        }
      } catch (err) {
        financialLogger.warn(
          { provider: providerName, symbol, date: priceDate, err },
          "Provider prices lookup failed"
        );
      }
    }

    return [];
  }

  /**
   * Convert an amount (in cents) from one currency to another.
   * The symbolMap maps providers to the symbol for the source currency.
   */
  async convert(
    amountCents: number,
    from: string,
    to: string,
    symbolMap: SymbolMap,
    date?: string
  ): Promise<ConvertResult | null> {
    if (from === to) {
      return {
        converted: amountCents,
        rate: 1,
        date: date ?? isoToday(),
        provider: "frankfurter" as ProviderName,
        stale: false,
      };
    }

    const rateResult = await this.getPrice(symbolMap, to, date);
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
   * Ensure market_prices has data for symbolMap in a currency over [from, to].
   * For each (provider, symbol) entry, checks cached dates and fetches missing ones.
   */
  async ensurePriceHistory(
    symbolMap: SymbolMap,
    currency: string,
    from: string,
    to: string
  ): Promise<void> {
    const entries = symbolMapEntries(symbolMap);

    for (const [providerName, symbol] of entries) {
      if (symbol === currency) continue;

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
      const expectedDays = daysBetween(from, to) + 1;
      if (expectedDays > 0 && cachedDates.size / expectedDays > 0.8) continue;

      const provider = this.factory(providerName);
      if (!provider?.getPriceRange) continue;

      financialLogger.debug(
        { provider: providerName, symbol, currency, from, to },
        "Backfilling price history"
      );

      try {
        const results = await provider.getPriceRange(symbol, currency, from, to);
        if (results.length > 0) {
          let inserted = 0;
          for (const r of results) {
            if (!cachedDates.has(r.date)) {
              this.cachePrice(r);
              inserted++;
            }
          }
          financialLogger.info(
            { provider: providerName, symbol, currency, from, to, inserted },
            "Price history backfilled"
          );
          return;
        }
      } catch (err) {
        financialLogger.warn(
          { provider: providerName, symbol, currency, from, to, err },
          "Provider price range lookup failed"
        );
      }
    }
  }

  // ─── Symbol Search ────────────────────────────────────────────────────────

  /**
   * Search for market symbols across all providers (discovery — broadcasts).
   */
  async searchSymbol(query: string): Promise<SymbolSearchResult[]> {
    const providers = this.buildDiscoveryProviders();
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
    const providers = this.buildDiscoveryProviders();
    const keyProviders = new Set<string>(["open-exchange-rates", "alpha-vantage"]);

    const statuses: ProviderStatus[] = providers.map((p) => ({
      name: p.name,
      type: (["frankfurter", "ecb", "open-exchange-rates"].includes(p.name)
        ? "exchange-rates"
        : "market-prices") as ProviderStatus["type"],
      apiKeyRequired: keyProviders.has(p.name),
      apiKeySet: !keyProviders.has(p.name) || !!this.getApiKey(p.name),
      healthy: null,
    }));

    const checks = await Promise.allSettled(
      providers.map((p) => (p.healthCheck ? p.healthCheck() : Promise.resolve(false)))
    );

    checks.forEach((result, i) => {
      statuses[i].healthy = result.status === "fulfilled" ? result.value : false;
    });

    financialLogger.debug(
      { providers: statuses.map((s) => ({ name: s.name, healthy: s.healthy })) },
      "Provider health check completed"
    );
    return statuses;
  }

  // ─── Cache ──────────────────────────────────────────────────────────────────

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
          fetchedAt: Temporal.Now.instant().toString(),
        },
      })
      .run();
  }

  // ─── Provider Builders ─────────────────────────────────────────────────────

  /** Build all available providers for discovery operations (search, status). */
  private buildDiscoveryProviders(): FinancialDataProvider[] {
    const all: ProviderName[] = [
      "frankfurter",
      "ecb",
      "coingecko",
      "open-exchange-rates",
      "alpha-vantage",
    ];
    return all
      .map((name) => this.factory(name))
      .filter((p): p is FinancialDataProvider => p !== null);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toPriceResult(row: MarketPriceRow): PriceResult {
  return {
    symbol: row.symbol,
    price: parseFloat(row.price),
    currency: row.currency,
    date: row.date,
    provider: row.provider as ProviderName,
  };
}

/** Extract defined entries from a SymbolMap (skips undefined values). */
function symbolMapEntries(symbolMap: SymbolMap): Array<[ProviderName, string]> {
  return Object.entries(symbolMap)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([name, symbol]) => [name as ProviderName, symbol]);
}

// Re-export for convenience
export type { PriceResult };
