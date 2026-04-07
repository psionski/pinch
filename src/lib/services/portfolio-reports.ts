import { Temporal } from "@js-temporal/polyfill";
import {
  isoToday,
  offsetDate,
  daysBetween,
  windowToDateRange,
  generateDatePoints,
} from "@/lib/date-ranges";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { assets, assetLots, transactions } from "@/lib/db/schema";
import { resolvePrice } from "./price-resolver";
import { findCachedFxRate } from "./fx-cache";
import { getBaseCurrency } from "@/lib/format";
import {
  type Db,
  parseAssetRow,
  getHoldingsAtDate,
  getCostBasisAtDate,
  consumeFifo,
} from "./portfolio-helpers";
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

export class PortfolioReportService {
  constructor(private db: Db) {}

  // ─── Net Worth Time Series ────────────────────────────────────────────────

  getNetWorthTimeSeries(window: Window, interval: Interval): NetWorthPoint[] {
    const dateRange = windowToDateRange(window);

    // For "all", start from the earliest transaction or lot, not 2000-01-01
    if (window === "all") {
      const firstTx = this.db
        .select({ date: transactions.date })
        .from(transactions)
        .orderBy(asc(transactions.date))
        .limit(1)
        .get();
      const firstLot = this.db
        .select({ date: assetLots.date })
        .from(assetLots)
        .orderBy(asc(assetLots.date))
        .limit(1)
        .get();
      const earliest = [firstTx?.date, firstLot?.date].filter(Boolean).sort()[0];
      if (earliest) dateRange.from = earliest;
    }

    const datePoints = generateDatePoints(dateRange.from, dateRange.to, interval);
    if (datePoints.length === 0) return [];

    const allAssets = this.db.select().from(assets).all().map(parseAssetRow);

    // ── Batch cash: fetch all transactions once, compute running totals ──
    const txRows = this.db
      .select({
        date: transactions.date,
        type: transactions.type,
        amount: transactions.amount,
      })
      .from(transactions)
      .where(lte(transactions.date, datePoints[datePoints.length - 1]))
      .orderBy(asc(transactions.date))
      .all();

    // Build cumulative cash at each date point in a single pass
    const cashAtDate = new Map<string, number>();
    let txIdx = 0;
    let runningCash = 0;
    for (const dp of datePoints) {
      while (txIdx < txRows.length && txRows[txIdx].date <= dp) {
        const row = txRows[txIdx];
        if (row.type === "income") runningCash += row.amount;
        else if (row.type === "expense") runningCash -= row.amount;
        else if (row.type === "transfer") runningCash += row.amount;
        txIdx++;
      }
      cashAtDate.set(dp, runningCash);
    }

    // ── Batch holdings: fetch all lots per asset once, compute running qty ──
    const holdingsPerAsset = new Map<number, Map<string, number>>();
    for (const asset of allAssets) {
      const lots = this.db
        .select({ date: assetLots.date, quantity: assetLots.quantity })
        .from(assetLots)
        .where(
          and(
            eq(assetLots.assetId, asset.id),
            lte(assetLots.date, datePoints[datePoints.length - 1])
          )
        )
        .orderBy(asc(assetLots.date), asc(assetLots.id))
        .all();

      const qtyAtDate = new Map<string, number>();
      let lotIdx = 0;
      let runningQty = 0;
      for (const dp of datePoints) {
        while (lotIdx < lots.length && lots[lotIdx].date <= dp) {
          runningQty += lots[lotIdx].quantity;
          lotIdx++;
        }
        qtyAtDate.set(dp, parseFloat(runningQty.toFixed(8)));
      }
      holdingsPerAsset.set(asset.id, qtyAtDate);
    }

    // ── Build result ────────────────────────────────────────────────────────
    return datePoints.map((date) => {
      const cash = cashAtDate.get(date) ?? 0;

      let assetTotal = 0;
      for (const asset of allAssets) {
        const holdings = holdingsPerAsset.get(asset.id)?.get(date) ?? 0;
        if (holdings <= 0) continue;

        const resolved = resolvePrice(this.db, asset, date);
        if (resolved) {
          assetTotal += Math.round(holdings * resolved.price * 100) / 100;
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
    const baseCurrency = getBaseCurrency();

    return allAssets
      .map((asset) => {
        const holdings = getHoldingsAtDate(this.db, asset.id, evalDate);
        const { costBasis, costBasisBase, earliestDate } = getCostBasisAtDate(
          this.db,
          asset.id,
          evalDate
        );

        if (costBasis === 0 && holdings <= 0) return null;

        const resolved = resolvePrice(this.db, asset, evalDate);
        if (!resolved) return null;
        const currentValue = Math.round(holdings * resolved.price * 100) / 100;
        const pnl = Math.round((currentValue - costBasis) * 100) / 100;
        const pnlPct = costBasis > 0 ? Math.round((pnl / costBasis) * 10000) / 100 : 0;

        // Convert current value to base currency. For base-currency assets the
        // FX rate is 1 and there's no decomposition to do. For foreign assets
        // we look up the most recent cached rate; if missing, base-side numbers
        // become null but the native-side numbers still render.
        let currentValueBase: number | null;
        let pnlBase: number | null;
        let pricePnlBase: number | null;
        let fxPnlBase: number | null;

        if (asset.currency === baseCurrency) {
          currentValueBase = currentValue;
          pnlBase = pnl;
          pricePnlBase = pnl;
          fxPnlBase = 0;
        } else {
          const currentRate = findCachedFxRate(this.db, asset.currency, baseCurrency, evalDate);
          if (currentRate === null) {
            currentValueBase = null;
            pnlBase = null;
            pricePnlBase = null;
            fxPnlBase = null;
          } else {
            currentValueBase = Math.round(currentValue * currentRate * 100) / 100;
            pnlBase = Math.round((currentValueBase - costBasisBase) * 100) / 100;
            // Decompose total base P&L into "asset price moved" vs "FX moved":
            //   pricePnlBase = (currentNative − costNative) × currentRate
            //   fxPnlBase    = pnlBase − pricePnlBase
            //                = costNative × (currentRate − historicalAvgRate)
            // where historicalAvgRate is implicit in costBasisBase / costBasis.
            pricePnlBase = Math.round((currentValue - costBasis) * currentRate * 100) / 100;
            fxPnlBase = Math.round((pnlBase - pricePnlBase) * 100) / 100;
          }
        }

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
          costBasisBase,
          currentValue,
          currentValueBase,
          pnl,
          pnlBase,
          pricePnlBase,
          fxPnlBase,
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
      const holdings = getHoldingsAtDate(this.db, asset.id, today);
      if (holdings <= 0) continue;

      const resolved = resolvePrice(this.db, asset, today);
      if (!resolved) continue;

      const currentValue = Math.round(holdings * resolved.price * 100) / 100;
      if (currentValue <= 0) continue;

      totalValue += currentValue;
      items.push({
        assetId: asset.id,
        name: asset.name,
        type: asset.type,
        currentValue,
        pct: 0,
      });
    }

    for (const item of items) {
      item.pct = totalValue > 0 ? Math.round((item.currentValue / totalValue) * 10000) / 100 : 0;
    }
    items.sort((a, b) => b.currentValue - a.currentValue);

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
      const holdings = getHoldingsAtDate(this.db, asset.id, today);
      if (holdings <= 0) continue;

      const resolved = resolvePrice(this.db, asset, today);
      if (!resolved) continue;

      const currentValue = Math.round(holdings * resolved.price * 100) / 100;
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
          pricePerUnitBase: assetLots.pricePerUnitBase,
          date: assetLots.date,
        })
        .from(assetLots)
        .where(eq(assetLots.assetId, asset.id))
        .orderBy(asc(assetLots.date), asc(assetLots.id))
        .all();

      const buyQueue: Array<{ qty: number; price: number; priceBase: number }> = [];
      let totalSold = 0;
      let proceeds = 0;
      let costOfSold = 0;

      for (const lot of lots) {
        if (lot.quantity < 0) {
          if (from && lot.date < from) {
            // Sell before range — still consume from queue for FIFO accuracy
            consumeFifo(buyQueue, -lot.quantity);
            continue;
          }
          if (to && lot.date > to) continue;
        }

        if (lot.quantity > 0) {
          buyQueue.push({
            qty: lot.quantity,
            price: lot.pricePerUnit,
            priceBase: lot.pricePerUnitBase,
          });
        } else {
          const toConsume = -lot.quantity;
          proceeds += Math.round(toConsume * lot.pricePerUnit * 100) / 100;
          totalSold += toConsume;
          costOfSold += consumeFifo(buyQueue, toConsume).cost;
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

    // For "all", start from the earliest lot instead of the hardcoded 2000-01-01
    if (window === "all") {
      const firstLot = this.db
        .select({ date: assetLots.date })
        .from(assetLots)
        .where(eq(assetLots.assetId, assetId))
        .orderBy(asc(assetLots.date))
        .limit(1)
        .get();
      if (firstLot) dateRange.from = firstLot.date;
    }

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

    let runningQty = getHoldingsAtDate(this.db, assetId, offsetDate(dateRange.from, -1));
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

    const datePoints = generateDatePoints(dateRange.from, dateRange.to, "weekly");

    // Batch holdings: fetch all lots up to last date point once,
    // then compute running quantity per date point in a single pass.
    const allLots = this.db
      .select({ date: assetLots.date, quantity: assetLots.quantity })
      .from(assetLots)
      .where(
        and(eq(assetLots.assetId, assetId), lte(assetLots.date, datePoints[datePoints.length - 1]))
      )
      .orderBy(asc(assetLots.date), asc(assetLots.id))
      .all();

    let lotIdx = 0;
    let cumulativeQty = 0;
    const timeline: AssetHistoryPoint[] = datePoints.map((date) => {
      while (lotIdx < allLots.length && allLots[lotIdx].date <= date) {
        cumulativeQty += allLots[lotIdx].quantity;
        lotIdx++;
      }
      const qty = parseFloat(cumulativeQty.toFixed(8));
      const resolved = resolvePrice(this.db, asset, date);
      const price = resolved?.price ?? null;
      const value = price !== null ? Math.round(qty * price * 100) / 100 : null;
      return { date, price, quantity: qty, value };
    });

    return { lots: lotHistory, timeline };
  }

  // ─── Transfer Summary ─────────────────────────────────────────────────────

  getTransferSummary(month: string): TransferSummaryItem[] {
    const dateFrom = `${month}-01`;
    const [y, m] = month.split("-").map(Number);
    const lastDay = Temporal.PlainYearMonth.from({ year: y, month: m }).daysInMonth;
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
        existing.purchases += Math.abs(row.amount);
      } else {
        existing.sales += Math.abs(row.amount);
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
}
