import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { assets, assetLots, transactions } from "@/lib/db/schema";
import { resolvePrice } from "./price-resolver";
import type { AssetResponse } from "@/lib/validators/assets";
import type {
  Window,
  Interval,
  NetWorthPoint,
  AssetPerformanceItem,
  AllocationResult,
  AllocationItem,
  AllocationByType,
  CurrencyExposureItem,
  RealizedPnlResult,
  RealizedPnlItem,
  AssetHistoryResult,
  AssetHistoryLot,
  AssetHistoryPoint,
  TransferSummaryItem,
} from "@/lib/validators/portfolio-reports";

type Db = BetterSQLite3Database<typeof schema>;

function parseAssetRow(row: schema.Asset): AssetResponse {
  return {
    id: row.id,
    name: row.name,
    type: row.type as AssetResponse["type"],
    currency: row.currency,
    symbolMap: row.symbolMap ? (JSON.parse(row.symbolMap) as Record<string, string>) : null,
    icon: row.icon,
    color: row.color,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PortfolioReportService {
  constructor(private db: Db) {}

  // ─── Net Worth Time Series ────────────────────────────────────────────────

  getNetWorthTimeSeries(window: Window, interval: Interval): NetWorthPoint[] {
    const dateRange = windowToDateRange(window);
    const datePoints = generateDatePoints(dateRange.from, dateRange.to, interval);

    const allAssets = this.db.select().from(assets).all().map(parseAssetRow);

    return datePoints.map((date) => {
      // Cash balance as of this date: income − expenses up to date
      const [cashRow] = this.db
        .select({
          income:
            sql<number>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amount} else 0 end), 0)`.mapWith(
              Number
            ),
          expenses:
            sql<number>`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amount} else 0 end), 0)`.mapWith(
              Number
            ),
        })
        .from(transactions)
        .where(lte(transactions.date, date))
        .all();

      // Asset purchase/sale flows up to this date
      const [flowRow] = this.db
        .select({
          purchases:
            sql<number>`coalesce(sum(case when ${assetLots.quantity} > 0 then ${transactions.amount} else 0 end), 0)`.mapWith(
              Number
            ),
          sales:
            sql<number>`coalesce(sum(case when ${assetLots.quantity} < 0 then ${transactions.amount} else 0 end), 0)`.mapWith(
              Number
            ),
        })
        .from(assetLots)
        .innerJoin(transactions, eq(assetLots.transactionId, transactions.id))
        .where(lte(assetLots.date, date))
        .all();

      const cash =
        (cashRow?.income ?? 0) -
        (cashRow?.expenses ?? 0) -
        (flowRow?.purchases ?? 0) +
        (flowRow?.sales ?? 0);

      // Asset values: for each asset, compute holdings and value at this date
      let assetTotal = 0;
      for (const asset of allAssets) {
        const holdings = this.getHoldingsAtDate(asset.id, date);
        if (holdings <= 0) continue;

        const resolved = resolvePrice(this.db, asset, date);
        if (resolved) {
          assetTotal += Math.round(holdings * resolved.price);
        }
      }

      return {
        date,
        cash,
        assets: assetTotal,
        total: cash + assetTotal,
      };
    });
  }

  // ─── Asset Performance ────────────────────────────────────────────────────

  getAssetPerformance(from?: string, to?: string): AssetPerformanceItem[] {
    const allAssets = this.db.select().from(assets).all().map(parseAssetRow);
    const today = isoToday();
    const evalDate = to ?? today;

    return allAssets
      .map((asset) => {
        const holdings = this.getHoldingsAtDate(asset.id, evalDate);
        const { costBasis, earliestDate } = this.getCostBasisAtDate(asset.id, evalDate);

        if (costBasis === 0 && holdings <= 0) return null;

        const resolved = resolvePrice(this.db, asset, evalDate);
        const currentValue = resolved ? Math.round(holdings * resolved.price) : costBasis;
        const pnl = currentValue - costBasis;
        const pnlPct = costBasis > 0 ? Math.round((pnl / costBasis) * 10000) / 100 : 0;

        const daysHeld = earliestDate ? Math.max(1, daysBetween(earliestDate, evalDate)) : 0;

        let annualizedReturn: number | null = null;
        if (daysHeld > 30 && costBasis > 0) {
          annualizedReturn =
            Math.round((Math.pow(currentValue / costBasis, 365 / daysHeld) - 1) * 10000) / 100;
        }

        return {
          assetId: asset.id,
          name: asset.name,
          type: asset.type as string,
          currency: asset.currency,
          costBasis,
          currentValue,
          pnl,
          pnlPct,
          annualizedReturn,
          daysHeld,
        } satisfies AssetPerformanceItem;
      })
      .filter((item): item is AssetPerformanceItem => item !== null)
      .sort((a, b) => b.pnl - a.pnl);
  }

  // ─── Allocation ───────────────────────────────────────────────────────────

  getAllocation(): AllocationResult {
    const allAssets = this.db.select().from(assets).all().map(parseAssetRow);
    const today = isoToday();

    const items: AllocationItem[] = [];
    let totalValue = 0;

    for (const asset of allAssets) {
      const holdings = this.getHoldingsAtDate(asset.id, today);
      if (holdings <= 0) continue;

      const resolved = resolvePrice(this.db, asset, today);
      if (!resolved) continue;

      const currentValue = Math.round(holdings * resolved.price);
      if (currentValue <= 0) continue;

      totalValue += currentValue;
      items.push({
        assetId: asset.id,
        name: asset.name,
        type: asset.type,
        currentValue,
        pct: 0, // computed below
      });
    }

    // Compute percentages
    for (const item of items) {
      item.pct = totalValue > 0 ? Math.round((item.currentValue / totalValue) * 10000) / 100 : 0;
    }
    items.sort((a, b) => b.currentValue - a.currentValue);

    // Group by type
    const typeMap = new Map<string, number>();
    for (const item of items) {
      typeMap.set(item.type, (typeMap.get(item.type) ?? 0) + item.currentValue);
    }
    const byType: AllocationByType[] = Array.from(typeMap.entries())
      .map(([type, currentValue]) => ({
        type,
        currentValue,
        pct: totalValue > 0 ? Math.round((currentValue / totalValue) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.currentValue - a.currentValue);

    return { byAsset: items, byType };
  }

  // ─── Currency Exposure ────────────────────────────────────────────────────

  getCurrencyExposure(): CurrencyExposureItem[] {
    const allAssets = this.db.select().from(assets).all().map(parseAssetRow);
    const today = isoToday();

    const currencyMap = new Map<string, number>();
    let totalValue = 0;

    for (const asset of allAssets) {
      const holdings = this.getHoldingsAtDate(asset.id, today);
      if (holdings <= 0) continue;

      const resolved = resolvePrice(this.db, asset, today);
      if (!resolved) continue;

      const currentValue = Math.round(holdings * resolved.price);
      if (currentValue <= 0) continue;

      currencyMap.set(asset.currency, (currencyMap.get(asset.currency) ?? 0) + currentValue);
      totalValue += currentValue;
    }

    return Array.from(currencyMap.entries())
      .map(([currency, value]) => ({
        currency,
        value,
        pct: totalValue > 0 ? Math.round((value / totalValue) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }

  // ─── Realized P&L ────────────────────────────────────────────────────────

  getRealizedPnL(from?: string, to?: string): RealizedPnlResult {
    const allAssets = this.db.select().from(assets).all().map(parseAssetRow);
    const items: RealizedPnlItem[] = [];
    let totalProceeds = 0;
    let totalCostBasis = 0;

    for (const asset of allAssets) {
      const lots = this.db
        .select({
          quantity: assetLots.quantity,
          pricePerUnit: assetLots.pricePerUnit,
          date: assetLots.date,
        })
        .from(assetLots)
        .where(eq(assetLots.assetId, asset.id))
        .orderBy(asc(assetLots.date), asc(assetLots.id))
        .all();

      // FIFO simulation to compute realized P&L from sell lots
      const buyQueue: Array<{ qty: number; price: number }> = [];
      let totalSold = 0;
      let proceeds = 0;
      let costOfSold = 0;

      for (const lot of lots) {
        // Apply date filter to sell lots only
        if (lot.quantity < 0) {
          if (from && lot.date < from) {
            // Sell before range — still consume from queue for FIFO accuracy
            let toConsume = -lot.quantity;
            while (toConsume > 0 && buyQueue.length > 0) {
              const front = buyQueue[0];
              if (front.qty <= toConsume) {
                toConsume -= front.qty;
                buyQueue.shift();
              } else {
                front.qty -= toConsume;
                toConsume = 0;
              }
            }
            continue;
          }
          if (to && lot.date > to) continue;
        }

        if (lot.quantity > 0) {
          buyQueue.push({ qty: lot.quantity, price: lot.pricePerUnit });
        } else {
          let toConsume = -lot.quantity;
          const sellPrice = lot.pricePerUnit;
          const sellTotal = Math.round(toConsume * sellPrice);

          totalSold += toConsume;
          proceeds += sellTotal;

          while (toConsume > 0 && buyQueue.length > 0) {
            const front = buyQueue[0];
            const consumed = Math.min(front.qty, toConsume);
            costOfSold += Math.round(consumed * front.price);
            front.qty -= consumed;
            toConsume -= consumed;
            if (front.qty <= 0) buyQueue.shift();
          }
        }
      }

      if (totalSold > 0) {
        items.push({
          assetId: asset.id,
          name: asset.name,
          totalSold,
          proceeds,
          costBasis: costOfSold,
          realizedPnl: proceeds - costOfSold,
        });
        totalProceeds += proceeds;
        totalCostBasis += costOfSold;
      }
    }

    items.sort((a, b) => b.realizedPnl - a.realizedPnl);

    return {
      items,
      totalProceeds,
      totalCostBasis,
      totalRealizedPnl: totalProceeds - totalCostBasis,
    };
  }

  // ─── Asset History ────────────────────────────────────────────────────────

  getAssetHistory(assetId: number, window: Window): AssetHistoryResult | null {
    const assetRow = this.db.select().from(assets).where(eq(assets.id, assetId)).get();
    if (!assetRow) return null;
    const asset = parseAssetRow(assetRow);

    const dateRange = windowToDateRange(window);

    // Lot timeline
    const lots = this.db
      .select({
        date: assetLots.date,
        quantity: assetLots.quantity,
        pricePerUnit: assetLots.pricePerUnit,
      })
      .from(assetLots)
      .where(
        and(
          eq(assetLots.assetId, assetId),
          gte(assetLots.date, dateRange.from),
          lte(assetLots.date, dateRange.to)
        )
      )
      .orderBy(asc(assetLots.date), asc(assetLots.id))
      .all();

    let runningQty = this.getHoldingsAtDate(assetId, offsetDate(dateRange.from, -1));
    const lotHistory: AssetHistoryLot[] = lots.map((lot) => {
      runningQty += lot.quantity;
      return {
        date: lot.date,
        quantity: Math.abs(lot.quantity),
        pricePerUnit: lot.pricePerUnit,
        type: lot.quantity > 0 ? "buy" : "sell",
        runningQuantity: runningQty,
      };
    });

    // Price/value timeline at weekly intervals
    const datePoints = generateDatePoints(dateRange.from, dateRange.to, "weekly");
    const timeline: AssetHistoryPoint[] = datePoints.map((date) => {
      const qty = this.getHoldingsAtDate(assetId, date);
      const resolved = resolvePrice(this.db, asset, date);
      const price = resolved?.price ?? null;
      const value = price !== null ? Math.round(qty * price) : null;
      return { date, price, quantity: qty, value };
    });

    return { lots: lotHistory, timeline };
  }

  // ─── Transfer Summary ─────────────────────────────────────────────────────

  getTransferSummary(month: string): TransferSummaryItem[] {
    const dateFrom = `${month}-01`;
    const [y, m] = month.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const dateTo = `${month}-${String(lastDay).padStart(2, "0")}`;

    const rows = this.db
      .select({
        assetId: assets.id,
        assetName: assets.name,
        assetType: assets.type,
        quantity: assetLots.quantity,
        amount: transactions.amount,
      })
      .from(assetLots)
      .innerJoin(assets, eq(assetLots.assetId, assets.id))
      .innerJoin(transactions, eq(assetLots.transactionId, transactions.id))
      .where(and(gte(assetLots.date, dateFrom), lte(assetLots.date, dateTo)))
      .all();

    const assetMap = new Map<
      number,
      { name: string; type: string; purchases: number; sales: number }
    >();

    for (const row of rows) {
      const existing = assetMap.get(row.assetId) ?? {
        name: row.assetName,
        type: row.assetType,
        purchases: 0,
        sales: 0,
      };

      if (row.quantity > 0) {
        existing.purchases += row.amount;
      } else {
        existing.sales += row.amount;
      }

      assetMap.set(row.assetId, existing);
    }

    return Array.from(assetMap.entries()).map(([assetId, data]) => ({
      assetId,
      assetName: data.name,
      assetType: data.type,
      purchases: data.purchases,
      sales: data.sales,
      net: data.purchases - data.sales,
    }));
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private getHoldingsAtDate(assetId: number, date: string): number {
    const [row] = this.db
      .select({
        total: sql<number>`coalesce(sum(${assetLots.quantity}), 0)`.mapWith(Number),
      })
      .from(assetLots)
      .where(and(eq(assetLots.assetId, assetId), lte(assetLots.date, date)))
      .all();
    return row?.total ?? 0;
  }

  private getCostBasisAtDate(
    assetId: number,
    date: string
  ): { costBasis: number; earliestDate: string | null } {
    const lots = this.db
      .select({
        quantity: assetLots.quantity,
        pricePerUnit: assetLots.pricePerUnit,
        date: assetLots.date,
      })
      .from(assetLots)
      .where(and(eq(assetLots.assetId, assetId), lte(assetLots.date, date)))
      .orderBy(asc(assetLots.date), asc(assetLots.id))
      .all();

    if (lots.length === 0) return { costBasis: 0, earliestDate: null };

    // FIFO cost basis
    const queue: Array<{ qty: number; price: number }> = [];
    for (const lot of lots) {
      if (lot.quantity > 0) {
        queue.push({ qty: lot.quantity, price: lot.pricePerUnit });
      } else {
        let toConsume = -lot.quantity;
        while (toConsume > 0 && queue.length > 0) {
          const front = queue[0];
          if (front.qty <= toConsume) {
            toConsume -= front.qty;
            queue.shift();
          } else {
            front.qty -= toConsume;
            toConsume = 0;
          }
        }
      }
    }

    const costBasis = Math.round(queue.reduce((sum, e) => sum + e.qty * e.price, 0));
    return { costBasis, earliestDate: lots[0].date };
  }
}

// ─── Date Utilities ──────────────────────────────────────────────────────────

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function offsetDate(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const a = new Date(from + "T00:00:00Z");
  const b = new Date(to + "T00:00:00Z");
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function windowToDateRange(window: Window): { from: string; to: string } {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);

  if (window === "all") {
    return { from: "2000-01-01", to };
  }

  if (window === "ytd") {
    return { from: `${today.getUTCFullYear()}-01-01`, to };
  }

  const months = window === "3m" ? 3 : window === "6m" ? 6 : 12;
  const fromDate = new Date(today);
  fromDate.setUTCMonth(fromDate.getUTCMonth() - months);
  return { from: fromDate.toISOString().slice(0, 10), to };
}

function generateDatePoints(from: string, to: string, interval: Interval): string[] {
  const points: string[] = [];
  const current = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");

  while (current <= end) {
    points.push(current.toISOString().slice(0, 10));

    if (interval === "daily") {
      current.setUTCDate(current.getUTCDate() + 1);
    } else if (interval === "weekly") {
      current.setUTCDate(current.getUTCDate() + 7);
    } else {
      current.setUTCMonth(current.getUTCMonth() + 1);
    }
  }

  // Always include the end date if not already there
  if (points.length === 0 || points[points.length - 1] !== to) {
    points.push(to);
  }

  return points;
}
