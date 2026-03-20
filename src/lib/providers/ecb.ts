import type { ExchangeRateResult, FinancialDataProvider } from "./types";

const DAILY_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
const HIST_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.xml";

/**
 * European Central Bank provider.
 * Provides daily EUR reference rates for ~30 currencies.
 * Rates are quoted as 1 EUR = X foreign currency, so we invert when base != EUR.
 * Historical data has a 1-day lag; current rates are published around 16:00 CET.
 */
export class EcbProvider implements FinancialDataProvider {
  readonly name = "ecb";
  readonly supportsExchangeRates = true;
  readonly supportsMarketPrices = false;

  async getExchangeRate(
    base: string,
    quote: string,
    date?: string
  ): Promise<ExchangeRateResult | null> {
    const rates = await this.getExchangeRates(base, date);
    return rates.find((r) => r.quote === quote) ?? null;
  }

  async getExchangeRates(base: string, date?: string): Promise<ExchangeRateResult[]> {
    const isHistorical = date && date < today();
    const url = isHistorical ? HIST_URL : DAILY_URL;

    const res = await fetch(url, {
      headers: { Accept: "application/xml" },
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];

    const xml = await res.text();
    const rateMap = parseEcbXml(xml, date);
    if (!rateMap) return [];

    // ECB publishes EUR-based rates (1 EUR = X currency).
    // Add EUR itself as a synthetic 1:1 rate.
    rateMap.set("EUR", 1);

    return buildResults(base, rateMap, date ?? latestDateFromXml(xml) ?? today(), this.name);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(DAILY_URL, { method: "HEAD" });
      return res.ok;
    } catch {
      return false;
    }
  }
}

// ─── XML Parsing ──────────────────────────────────────────────────────────────

/**
 * Parses ECB XML and returns a map of currency → rate (relative to EUR).
 * For the daily feed, returns the single Cube entry.
 * For the historical feed, finds the Cube for the requested date (or the most recent).
 */
function parseEcbXml(xml: string, date?: string): Map<string, number> | null {
  // Extract all <Cube time="..."> blocks
  const cubeRegex = /<Cube\s+time=['"]([^'"]+)['"]\s*>([\s\S]*?)<\/Cube>/g;
  let best: { date: string; content: string } | null = null;

  let m: RegExpExecArray | null;
  while ((m = cubeRegex.exec(xml)) !== null) {
    const cubeDate = m[1];
    const content = m[2];
    if (date) {
      if (cubeDate === date) {
        best = { date: cubeDate, content };
        break;
      }
      // Pick the closest date not after requested date
      if (cubeDate <= date) {
        if (!best || cubeDate > best.date) {
          best = { date: cubeDate, content };
        }
      }
    } else {
      // No date specified — pick latest
      if (!best || cubeDate > best.date) {
        best = { date: cubeDate, content };
      }
    }
  }

  if (!best) return null;

  const rateMap = new Map<string, number>();
  const rateRegex = /<Cube\s+currency=['"]([A-Z]+)['"]\s+rate=['"]([^'"]+)['"]\s*\/>/g;
  let r: RegExpExecArray | null;
  while ((r = rateRegex.exec(best.content)) !== null) {
    rateMap.set(r[1], parseFloat(r[2]));
  }

  return rateMap;
}

function latestDateFromXml(xml: string): string | null {
  const m = /<Cube\s+time=['"]([^'"]+)['"]/.exec(xml);
  return m ? m[1] : null;
}

// ─── Rate Conversion ──────────────────────────────────────────────────────────

/**
 * Given a map of EUR-based rates, produce ExchangeRateResult[] for all quotes
 * from the given base currency.
 */
function buildResults(
  base: string,
  eurRates: Map<string, number>,
  date: string,
  provider: string
): ExchangeRateResult[] {
  const baseInEur = eurRates.get(base);
  if (baseInEur === undefined) return [];

  const results: ExchangeRateResult[] = [];
  for (const [currency, eurRate] of eurRates) {
    if (currency === base) continue;
    // 1 base = (eurRate / baseInEur) quote
    results.push({
      base,
      quote: currency,
      rate: eurRate / baseInEur,
      date,
      provider,
    });
  }
  return results;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
