import type { PriceResult, FinancialDataProvider } from "./types";

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

  async getPrice(symbol: string, currency: string, date?: string): Promise<PriceResult | null> {
    const prices = await this.getPrices(symbol, date);
    return prices.find((r) => r.currency === currency) ?? null;
  }

  async getPrices(symbol: string, date?: string): Promise<PriceResult[]> {
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

    return buildResults(symbol, rateMap, date ?? latestDateFromXml(xml) ?? today(), this.name);
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

function parseEcbXml(xml: string, date?: string): Map<string, number> | null {
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
      if (cubeDate <= date) {
        if (!best || cubeDate > best.date) {
          best = { date: cubeDate, content };
        }
      }
    } else {
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

function buildResults(
  symbol: string,
  eurRates: Map<string, number>,
  date: string,
  provider: string
): PriceResult[] {
  const baseInEur = eurRates.get(symbol);
  if (baseInEur === undefined) return [];

  const results: PriceResult[] = [];
  for (const [currency, eurRate] of eurRates) {
    if (currency === symbol) continue;
    results.push({
      symbol,
      price: eurRate / baseInEur,
      currency,
      date,
      provider,
    });
  }
  return results;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
