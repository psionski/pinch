// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "../helpers";
import { AssetService } from "@/lib/services/assets";
import { AssetLotService } from "@/lib/services/asset-lots";
import { AssetPriceService } from "@/lib/services/asset-prices";
import { PortfolioReportService } from "@/lib/services/portfolio-reports";
import { TransactionService } from "@/lib/services/transactions";
import { ReportService } from "@/lib/services/reports";
import { isoToday } from "@/lib/date-ranges";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";

let db: BetterSQLite3Database<typeof schema>;
let assetService: AssetService;
let lotService: AssetLotService;
let priceService: AssetPriceService;
let reportService: PortfolioReportService;
let txService: TransactionService;
let spendingReportService: ReportService;

beforeEach(() => {
  db = makeTestDb();
  assetService = new AssetService(db);
  lotService = new AssetLotService(db);
  priceService = new AssetPriceService(db);
  reportService = new PortfolioReportService(db);
  txService = new TransactionService(db);
  spendingReportService = new ReportService(db);
});

// ─── Asset Performance ──────────────────────────────────────────────────────

describe("getAssetPerformance", () => {
  it("returns empty array when no assets", () => {
    const result = reportService.getAssetPerformance();
    expect(result).toHaveLength(0);
  });

  it("computes performance for a single asset with buy and price snapshot", () => {
    const asset = assetService.create({ name: "SPX", type: "investment", currency: "EUR" });
    lotService.buy(asset.id, { quantity: 10, pricePerUnit: 30000, date: "2026-01-15" });
    priceService.record(asset.id, { pricePerUnit: 35000, recordedAt: `${isoToday()}T10:00:00Z` });

    const result = reportService.getAssetPerformance();
    expect(result).toHaveLength(1);

    const item = result[0];
    expect(item.assetId).toBe(asset.id);
    expect(item.costBasis).toBe(300000); // 10 * 30000
    expect(item.currentValue).toBe(350000); // 10 * 35000
    expect(item.pnl).toBe(50000);
    expect(item.pnlPct).toBeGreaterThan(0);
    expect(item.daysHeld).toBeGreaterThan(0);
  });

  it("sorts by P&L descending", () => {
    const a1 = assetService.create({ name: "Winner", type: "crypto", currency: "EUR" });
    lotService.buy(a1.id, { quantity: 1, pricePerUnit: 10000, date: "2026-01-01" });
    priceService.record(a1.id, { pricePerUnit: 20000, recordedAt: `${isoToday()}T00:00:00Z` });

    const a2 = assetService.create({ name: "Loser", type: "crypto", currency: "EUR" });
    lotService.buy(a2.id, { quantity: 1, pricePerUnit: 20000, date: "2026-01-01" });
    priceService.record(a2.id, { pricePerUnit: 15000, recordedAt: `${isoToday()}T00:00:00Z` });

    const result = reportService.getAssetPerformance();
    expect(result[0].name).toBe("Winner");
    expect(result[1].name).toBe("Loser");
  });
});

// ─── Allocation ─────────────────────────────────────────────────────────────

describe("getAllocation", () => {
  it("returns empty allocation when no assets", () => {
    const result = reportService.getAllocation();
    expect(result.byAsset).toHaveLength(0);
    expect(result.byType).toHaveLength(0);
  });

  it("computes allocation percentages for multiple assets", () => {
    const a1 = assetService.create({ name: "Savings", type: "deposit", currency: "EUR" });
    lotService.buy(a1.id, { quantity: 1000, pricePerUnit: 100, date: "2026-01-01" });

    const a2 = assetService.create({ name: "BTC", type: "crypto", currency: "EUR" });
    lotService.buy(a2.id, { quantity: 1, pricePerUnit: 10000, date: "2026-01-01" });
    priceService.record(a2.id, { pricePerUnit: 10000, recordedAt: `${isoToday()}T00:00:00Z` });

    const result = reportService.getAllocation();
    expect(result.byAsset).toHaveLength(2);

    // Total should be 100000 (savings) + 10000 (BTC) = 110000
    const totalPct = result.byAsset.reduce((s, a) => s + a.pct, 0);
    // Percentages should sum roughly to 100
    expect(totalPct).toBeCloseTo(100, 0);
  });

  it("groups by type", () => {
    const a1 = assetService.create({ name: "Savings", type: "deposit", currency: "EUR" });
    lotService.buy(a1.id, { quantity: 1000, pricePerUnit: 100, date: "2026-01-01" });

    const a2 = assetService.create({ name: "Emergency", type: "deposit", currency: "EUR" });
    lotService.buy(a2.id, { quantity: 500, pricePerUnit: 100, date: "2026-01-01" });

    const result = reportService.getAllocation();
    expect(result.byType).toHaveLength(1);
    expect(result.byType[0].type).toBe("deposit");
    expect(result.byType[0].pct).toBe(100);
  });
});

// ─── Currency Exposure ──────────────────────────────────────────────────────

describe("getCurrencyExposure", () => {
  it("returns empty when no assets", () => {
    expect(reportService.getCurrencyExposure()).toHaveLength(0);
  });

  it("groups assets by currency", () => {
    const a1 = assetService.create({ name: "EUR Savings", type: "deposit", currency: "EUR" });
    lotService.buy(a1.id, { quantity: 1000, pricePerUnit: 100, date: "2026-01-01" });

    const a2 = assetService.create({ name: "USD Account", type: "deposit", currency: "USD" });
    lotService.buy(a2.id, { quantity: 500, pricePerUnit: 100, date: "2026-01-01" });

    const result = reportService.getCurrencyExposure();
    expect(result).toHaveLength(2);

    const eur = result.find((r) => r.currency === "EUR");
    const usd = result.find((r) => r.currency === "USD");
    expect(eur).toBeDefined();
    expect(usd).toBeDefined();
    // EUR: 1000*100=100000 / USD: 500*100=50000 — EUR should have higher pct
    expect(eur!.value).toBeGreaterThan(usd!.value);
  });
});

// ─── Realized P&L ───────────────────────────────────────────────────────────

describe("getRealizedPnL", () => {
  it("returns empty when no sells", () => {
    const asset = assetService.create({ name: "ETF", type: "investment", currency: "EUR" });
    lotService.buy(asset.id, { quantity: 10, pricePerUnit: 10000, date: "2026-01-01" });

    const result = reportService.getRealizedPnL();
    expect(result.items).toHaveLength(0);
    expect(result.totalRealizedPnl).toBe(0);
  });

  it("computes FIFO realized P&L from sells", () => {
    const asset = assetService.create({ name: "BTC", type: "crypto", currency: "EUR" });
    // Buy 2 at €100
    lotService.buy(asset.id, { quantity: 2, pricePerUnit: 10000, date: "2026-01-01" });
    // Sell 1 at €150
    lotService.sell(asset.id, { quantity: 1, pricePerUnit: 15000, date: "2026-02-01" });

    const result = reportService.getRealizedPnL();
    expect(result.items).toHaveLength(1);
    expect(result.items[0].totalSold).toBe(1);
    expect(result.items[0].proceeds).toBe(15000); // 1 * 15000
    expect(result.items[0].costBasis).toBe(10000); // FIFO: first lot @ 10000
    expect(result.items[0].realizedPnl).toBe(5000);
    expect(result.totalRealizedPnl).toBe(5000);
  });

  it("filters by date range", () => {
    const asset = assetService.create({ name: "ETF", type: "investment", currency: "EUR" });
    lotService.buy(asset.id, { quantity: 10, pricePerUnit: 10000, date: "2026-01-01" });
    lotService.sell(asset.id, { quantity: 5, pricePerUnit: 12000, date: "2026-02-15" });
    lotService.sell(asset.id, { quantity: 3, pricePerUnit: 13000, date: "2026-03-15" });

    // Only March sells
    const result = reportService.getRealizedPnL("2026-03-01", "2026-03-31");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].totalSold).toBe(3);
  });
});

// ─── Asset History ──────────────────────────────────────────────────────────

describe("getAssetHistory", () => {
  it("returns null for non-existent asset", () => {
    expect(reportService.getAssetHistory(999, "6m")).toBeNull();
  });

  it("returns lot timeline and value points", () => {
    const asset = assetService.create({ name: "SPX", type: "investment", currency: "EUR" });
    lotService.buy(asset.id, { quantity: 5, pricePerUnit: 30000, date: "2026-01-15" });
    lotService.buy(asset.id, { quantity: 3, pricePerUnit: 31000, date: "2026-02-15" });
    priceService.record(asset.id, { pricePerUnit: 32000, recordedAt: `${isoToday()}T00:00:00Z` });

    const result = reportService.getAssetHistory(asset.id, "all");
    expect(result).not.toBeNull();
    expect(result!.lots).toHaveLength(2);
    expect(result!.lots[0].type).toBe("buy");
    expect(result!.lots[0].runningQuantity).toBe(5);
    expect(result!.lots[1].runningQuantity).toBe(8);
    expect(result!.timeline.length).toBeGreaterThan(0);
  });

  it("'all' window starts from earliest lot, not year 2000", () => {
    const asset = assetService.create({ name: "ETF", type: "investment", currency: "EUR" });
    lotService.buy(asset.id, { quantity: 10, pricePerUnit: 10000, date: "2025-06-15" });

    const result = reportService.getAssetHistory(asset.id, "all");
    expect(result).not.toBeNull();
    // Timeline should start near the first lot date, not 2000-01-01
    expect(result!.timeline[0].date >= "2025-06-01").toBe(true);
    expect(result!.timeline[0].date < "2025-07-01").toBe(true);
  });
});

// ─── Transfer Summary ───────────────────────────────────────────────────────

describe("getTransferSummary", () => {
  it("returns empty for months with no transfers", () => {
    const result = reportService.getTransferSummary("2026-01");
    expect(result).toHaveLength(0);
  });

  it("groups purchases and sales by asset for a month", () => {
    const a1 = assetService.create({ name: "ETF", type: "investment", currency: "EUR" });
    lotService.buy(a1.id, { quantity: 5, pricePerUnit: 10000, date: "2026-03-01" });
    lotService.buy(a1.id, { quantity: 3, pricePerUnit: 10500, date: "2026-03-15" });

    const result = reportService.getTransferSummary("2026-03");
    expect(result).toHaveLength(1);
    expect(result[0].assetId).toBe(a1.id);
    expect(result[0].purchases).toBe(50000 + 31500); // 5*10000 + 3*10500
    expect(result[0].sales).toBe(0);
  });
});

// ─── Net Worth Time Series ──────────────────────────────────────────────────

describe("getNetWorthTimeSeries", () => {
  it("returns time series with cash and asset values", () => {
    txService.create({ amount: 500000, type: "income", description: "Salary", date: "2026-01-01" });

    const asset = assetService.create({ name: "Savings", type: "deposit", currency: "EUR" });
    lotService.buy(asset.id, { quantity: 2000, pricePerUnit: 100, date: "2026-01-15" });

    const result = reportService.getNetWorthTimeSeries("all", "monthly");
    expect(result.length).toBeGreaterThan(0);

    // The last point should show cash + assets = net worth
    const last = result[result.length - 1];
    expect(last.total).toBe(last.cash + last.assets);
  });

  it("returns single point for empty portfolio", () => {
    const result = reportService.getNetWorthTimeSeries("3m", "monthly");
    expect(result.length).toBeGreaterThan(0);
    // All zeros
    for (const point of result) {
      expect(point.cash).toBe(0);
      expect(point.assets).toBe(0);
      expect(point.total).toBe(0);
    }
  });
});

// ─── Spending Summary with includeTransfers ─────────────────────────────────

describe("spendingSummary includeTransfers", () => {
  it("includes transfers section when flag is true", () => {
    txService.create({ amount: 500000, type: "income", description: "Salary", date: "2026-03-01" });
    txService.create({ amount: 30000, type: "expense", description: "Rent", date: "2026-03-05" });

    const asset = assetService.create({ name: "ETF", type: "investment", currency: "EUR" });
    lotService.buy(asset.id, { quantity: 5, pricePerUnit: 10000, date: "2026-03-10" });

    const result = spendingReportService.spendingSummary({
      dateFrom: "2026-03-01",
      dateTo: "2026-03-31",
      groupBy: "category",
      type: "expense",
      includeTransfers: true,
    });

    expect(result.transfers).toBeDefined();
    expect(result.transfers!).toHaveLength(1);
    expect(result.transfers![0].assetName).toBe("ETF");
    expect(result.transfers![0].purchases).toBe(50000);
  });

  it("omits transfers when flag is false", () => {
    const result = spendingReportService.spendingSummary({
      dateFrom: "2026-03-01",
      dateTo: "2026-03-31",
      groupBy: "category",
      type: "expense",
      includeTransfers: false,
    });

    expect(result.transfers).toBeUndefined();
  });
});
