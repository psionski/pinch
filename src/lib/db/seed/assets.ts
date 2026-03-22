import { Temporal } from "@js-temporal/polyfill";
import { isoDate } from "./rng";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssetSeed {
  asset: {
    name: string;
    type: "deposit" | "investment" | "crypto";
    currency: string;
    symbolMap?: string;
    icon?: string;
    color?: string;
    notes?: string;
  };
  lots: Array<{
    quantity: number;
    pricePerUnit: number;
    date: string;
    description: string;
    notes?: string;
  }>;
}

export interface MarketPriceSeed {
  symbol: string;
  price: string;
  currency: string;
  date: string;
  provider: string;
}

type MonthSpec = { year: number; month: number; lastDay: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateAt(m: MonthSpec, day: number): string {
  return isoDate(m.year, m.month, Math.min(day, m.lastDay));
}

/** Generate dates at `step`-day intervals from `from` through `to` (inclusive). */
function dateRange(from: string, to: string, step: number): string[] {
  const dates: string[] = [];
  let cur = Temporal.PlainDate.from(from);
  const end = Temporal.PlainDate.from(to);
  while (Temporal.PlainDate.compare(cur, end) <= 0) {
    dates.push(cur.toString());
    cur = cur.add({ days: step });
  }
  return dates;
}

/** Convert YYYY-MM-DD to days since epoch for interpolation math. */
function dateToDays(date: string): number {
  return Temporal.PlainDate.from(date)
    .since(Temporal.PlainDate.from("1970-01-01"), { largestUnit: "days" })
    .total("days");
}

/** Linear interpolation between sorted anchor points. */
function lerp(anchors: Array<{ date: string; value: number }>, target: string): number {
  const t = dateToDays(target);
  if (t <= dateToDays(anchors[0].date)) return anchors[0].value;
  const last = anchors[anchors.length - 1];
  if (t >= dateToDays(last.date)) return last.value;
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = dateToDays(anchors[i].date);
    const b = dateToDays(anchors[i + 1].date);
    if (t >= a && t <= b) {
      const frac = (t - a) / (b - a);
      return anchors[i].value + frac * (anchors[i + 1].value - anchors[i].value);
    }
  }
  return last.value;
}

interface LotDef {
  monthIdx: number;
  day: number;
  quantity: number;
  pricePerUnit: number;
  description: string;
  notes?: string;
}

/** Convert lot definitions to concrete lots, filtering out lots past the month's lastDay. */
function buildLots(defs: LotDef[], months: MonthSpec[]): AssetSeed["lots"] {
  return defs
    .filter((d) => d.day <= months[d.monthIdx].lastDay)
    .map((d) => ({
      quantity: d.quantity,
      pricePerUnit: d.pricePerUnit,
      date: dateAt(months[d.monthIdx], d.day),
      description: d.description,
      notes: d.notes,
    }));
}

// ─── Generator ────────────────────────────────────────────────────────────────

/**
 * Generate portfolio seed data: three assets with buy/sell lots and weekly
 * market prices for chart resolution.
 *
 * Demonstrates:
 * - EUR deposit with monthly deposits & a withdrawal
 * - Crypto with buys, a partial sell (realized P&L), and volatile pricing
 * - Investment ETF with monthly DCA and steady growth
 * - Allocation across asset types (deposit / crypto / investment)
 * - Net worth time series with multiple asset classes
 */
export function generateAssets(months: MonthSpec[]): {
  assets: AssetSeed[];
  marketPrices: MarketPriceSeed[];
} {
  const [m0, m1, m2, m3] = months;

  // Weekly date points for market price data
  const priceDates = dateRange(dateAt(m0, 1), dateAt(m3, m3.lastDay), 7);

  // ── Savings Account (EUR deposit) ──────────────────────────────────────────
  // €300/month deposits (after salary day 25), one €300 withdrawal

  const savings: AssetSeed = {
    asset: {
      name: "Savings Account",
      type: "deposit",
      currency: "EUR",
      icon: "🏦",
      color: "#34d399",
      notes: "Emergency fund and general savings",
    },
    lots: buildLots(
      [
        { monthIdx: 0, day: 26, quantity: 300, pricePerUnit: 100, description: "Monthly savings" },
        { monthIdx: 1, day: 26, quantity: 300, pricePerUnit: 100, description: "Monthly savings" },
        {
          monthIdx: 2,
          day: 10,
          quantity: -300,
          pricePerUnit: 100,
          description: "Withdrawal for holiday booking",
          notes: "Booked spring trip",
        },
        { monthIdx: 2, day: 26, quantity: 300, pricePerUnit: 100, description: "Monthly savings" },
        { monthIdx: 3, day: 5, quantity: 300, pricePerUnit: 100, description: "Monthly savings" },
      ],
      months
    ),
  };

  // ── Bitcoin (crypto) ───────────────────────────────────────────────────────
  // Price: ~€75k → crash to ~€65k → surge to ~€88k → settle ~€82k
  // Buy on dips, partial sell near peak for realized P&L

  const btcAnchors = [
    { date: dateAt(m0, 1), value: 75000 },
    { date: dateAt(m0, 12), value: 72000 },
    { date: dateAt(m0, 25), value: 78000 },
    { date: dateAt(m1, 5), value: 74000 },
    { date: dateAt(m1, 15), value: 65000 },
    { date: dateAt(m1, 22), value: 68000 },
    { date: dateAt(m1, 28), value: 70000 },
    { date: dateAt(m2, 7), value: 78000 },
    { date: dateAt(m2, 14), value: 85000 },
    { date: dateAt(m2, 21), value: 88000 },
    { date: dateAt(m2, 28), value: 86000 },
    { date: dateAt(m3, 5), value: 84000 },
    { date: dateAt(m3, m3.lastDay), value: 82000 },
  ];

  const btcMarket: MarketPriceSeed[] = priceDates.map((date) => ({
    symbol: "bitcoin",
    price: String(Math.round(lerp(btcAnchors, date))),
    currency: "EUR",
    date,
    provider: "coingecko",
  }));

  const bitcoin: AssetSeed = {
    asset: {
      name: "Bitcoin",
      type: "crypto",
      currency: "EUR",
      symbolMap: JSON.stringify({ coingecko: "bitcoin" }),
      icon: "₿",
      color: "#f7931a",
      notes: "Long-term BTC position, DCA strategy",
    },
    lots: buildLots(
      [
        {
          monthIdx: 0,
          day: 28,
          quantity: 0.005,
          pricePerUnit: 7700000, // €77,000
          description: "Buy 0.005 BTC",
          notes: "Initial position",
        },
        {
          monthIdx: 1,
          day: 27,
          quantity: 0.005,
          pricePerUnit: 6900000, // €69,000
          description: "Buy 0.005 BTC (buying the dip)",
          notes: "DCA on dip",
        },
        {
          monthIdx: 2,
          day: 22,
          quantity: -0.004,
          pricePerUnit: 8700000, // €87,000
          description: "Sell 0.004 BTC (take profit)",
          notes: "Partial profit taking",
        },
        {
          monthIdx: 3,
          day: 12,
          quantity: 0.003,
          pricePerUnit: 8300000, // €83,000
          description: "Buy 0.003 BTC",
          notes: "Resuming DCA",
        },
      ],
      months
    ),
  };

  // ── MSCI World ETF (investment) ─────────────────────────────────────────────
  // Price: ~€95 → steady climb to ~€98.50
  // Monthly DCA of 1 share

  const etfAnchors = [
    { date: dateAt(m0, 1), value: 95.0 },
    { date: dateAt(m0, 15), value: 95.5 },
    { date: dateAt(m0, 28), value: 96.3 },
    { date: dateAt(m1, 10), value: 94.5 },
    { date: dateAt(m1, 20), value: 94.2 },
    { date: dateAt(m1, 28), value: 95.5 },
    { date: dateAt(m2, 10), value: 96.5 },
    { date: dateAt(m2, 20), value: 97.0 },
    { date: dateAt(m2, 28), value: 97.5 },
    { date: dateAt(m3, 5), value: 98.0 },
    { date: dateAt(m3, m3.lastDay), value: 98.5 },
  ];

  const etfMarket: MarketPriceSeed[] = priceDates.map((date) => ({
    symbol: "IWDA.AS",
    price: lerp(etfAnchors, date).toFixed(2),
    currency: "EUR",
    date,
    provider: "alpha-vantage",
  }));

  const etf: AssetSeed = {
    asset: {
      name: "MSCI World ETF",
      type: "investment",
      currency: "EUR",
      symbolMap: JSON.stringify({ "alpha-vantage": "IWDA.AS" }),
      icon: "📈",
      color: "#3b82f6",
      notes: "Core index position, monthly DCA",
    },
    lots: buildLots(
      [
        { monthIdx: 0, day: 28, quantity: 1, pricePerUnit: 9630, description: "Buy 1 IWDA share" },
        { monthIdx: 1, day: 28, quantity: 1, pricePerUnit: 9550, description: "Buy 1 IWDA share" },
        { monthIdx: 2, day: 28, quantity: 1, pricePerUnit: 9750, description: "Buy 1 IWDA share" },
        { monthIdx: 3, day: 3, quantity: 1, pricePerUnit: 9800, description: "Buy 1 IWDA share" },
      ],
      months
    ),
  };

  return {
    assets: [savings, bitcoin, etf],
    marketPrices: [...btcMarket, ...etfMarket],
  };
}
