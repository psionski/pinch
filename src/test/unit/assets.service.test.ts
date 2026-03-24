// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "../helpers";
import { AssetService } from "@/lib/services/assets";
import { AssetLotService } from "@/lib/services/asset-lots";
import { AssetPriceService } from "@/lib/services/asset-prices";
import { PortfolioService } from "@/lib/services/portfolio";
import { TransactionService } from "@/lib/services/transactions";
import { isoToday } from "@/lib/date-ranges";

let assetService: AssetService;
let lotService: AssetLotService;
let priceService: AssetPriceService;
let portfolioService: PortfolioService;
let txService: TransactionService;

beforeEach(() => {
  const db = makeTestDb();
  assetService = new AssetService(db);
  lotService = new AssetLotService(db);
  priceService = new AssetPriceService(db);
  portfolioService = new PortfolioService(db);
  txService = new TransactionService(db);
});

// ─── AssetService ─────────────────────────────────────────────────────────────

describe("AssetService", () => {
  it("creates an asset and retrieves it", () => {
    const asset = assetService.create({
      name: "Emergency Fund",
      type: "deposit",
      currency: "EUR",
    });
    expect(asset.id).toBeGreaterThan(0);
    expect(asset.name).toBe("Emergency Fund");
    expect(asset.type).toBe("deposit");
    expect(asset.currency).toBe("EUR");
  });

  it("list returns assets with zero metrics when no lots", () => {
    // Investment with no price snapshot → currentValue/pnl are null
    assetService.create({ name: "My Stocks", type: "investment", currency: "EUR" });
    const list = assetService.list();
    expect(list).toHaveLength(1);
    expect(list[0].currentHoldings).toBe(0);
    expect(list[0].costBasis).toBe(0);
    expect(list[0].currentValue).toBeNull();
    expect(list[0].pnl).toBeNull();
  });

  it("getById returns null for missing asset", () => {
    expect(assetService.getById(999)).toBeNull();
  });

  it("update changes asset metadata", () => {
    const asset = assetService.create({ name: "BTC", type: "crypto", currency: "EUR" });
    const updated = assetService.update(asset.id, { name: "Bitcoin", icon: "₿" });
    expect(updated?.name).toBe("Bitcoin");
    expect(updated?.icon).toBe("₿");
  });

  it("delete removes asset and returns true", () => {
    const asset = assetService.create({ name: "To Delete", type: "other", currency: "EUR" });
    expect(assetService.delete(asset.id)).toBe(true);
    expect(assetService.getById(asset.id)).toBeNull();
  });

  it("delete returns false for missing asset", () => {
    expect(assetService.delete(999)).toBe(false);
  });

  it("EUR deposit with no price uses €1 fallback for currentValue", () => {
    const asset = assetService.create({ name: "Savings", type: "deposit", currency: "EUR" });
    // Buy 1000 units (€1000)
    lotService.buy(asset.id, { quantity: 1000, pricePerUnit: 100, date: "2026-01-01" });
    const retrieved = assetService.getById(asset.id);
    expect(retrieved?.currentHoldings).toBe(1000);
    expect(retrieved?.currentValue).toBe(100000); // 1000 * 100 = 100000 cents = €1000
    expect(retrieved?.pnl).toBe(0); // cost = value for €1 deposits
  });

  it("buy auto-records price snapshot, so currentValue is available", () => {
    const asset = assetService.create({ name: "USD Bond", type: "investment", currency: "USD" });
    lotService.buy(asset.id, { quantity: 1000, pricePerUnit: 110, date: "2026-01-01" });
    const retrieved = assetService.getById(asset.id);
    expect(retrieved?.latestPrice).toBe(110);
    expect(retrieved?.currentValue).toBe(110000); // 1000 * 110
  });

  it("computes correct metrics with price snapshot", () => {
    const today = isoToday();
    const asset = assetService.create({ name: "SPX", type: "investment", currency: "EUR" });
    lotService.buy(asset.id, { quantity: 10, pricePerUnit: 34563, date: "2026-01-01" });
    priceService.record(asset.id, { pricePerUnit: 36000, recordedAt: `${today}T10:00:00Z` });

    const retrieved = assetService.getById(asset.id);
    expect(retrieved?.currentHoldings).toBe(10);
    expect(retrieved?.costBasis).toBe(345630); // 10 * 34563
    expect(retrieved?.currentValue).toBe(360000); // 10 * 36000
    expect(retrieved?.pnl).toBe(14370); // 360000 - 345630
  });
});

// ─── AssetLotService ─────────────────────────────────────────────────────────

describe("AssetLotService", () => {
  it("buy creates a transfer transaction and an asset lot atomically", () => {
    const asset = assetService.create({ name: "BTC", type: "crypto", currency: "EUR" });
    const { lot, transaction } = lotService.buy(asset.id, {
      quantity: 0.5,
      pricePerUnit: 8000000,
      date: "2026-03-01",
    });

    expect(lot.assetId).toBe(asset.id);
    expect(lot.quantity).toBe(0.5);
    expect(lot.pricePerUnit).toBe(8000000);
    expect(lot.transactionId).toBe(transaction.id);

    expect(transaction.type).toBe("transfer");
    expect(transaction.amount).toBe(4000000); // 0.5 * 8000000
    expect(transaction.date).toBe("2026-03-01");
  });

  it("buy uses custom description when provided", () => {
    const asset = assetService.create({ name: "ETF", type: "investment", currency: "EUR" });
    const { transaction } = lotService.buy(asset.id, {
      quantity: 5,
      pricePerUnit: 10000,
      date: "2026-03-01",
      description: "Monthly ETF purchase",
    });
    expect(transaction.description).toBe("Monthly ETF purchase");
  });

  it("buy auto-generates description when none provided", () => {
    const asset = assetService.create({ name: "SPX", type: "investment", currency: "EUR" });
    const { transaction } = lotService.buy(asset.id, {
      quantity: 2,
      pricePerUnit: 34563,
      date: "2026-03-01",
    });
    expect(transaction.description).toContain("SPX");
    expect(transaction.description).toContain("Buy");
  });

  it("buy auto-generates 'Deposit' description for deposit assets", () => {
    const asset = assetService.create({ name: "Savings", type: "deposit", currency: "EUR" });
    const { transaction } = lotService.buy(asset.id, {
      quantity: 5000,
      pricePerUnit: 100,
      date: "2026-03-01",
    });
    expect(transaction.description).toContain("Deposit");
    expect(transaction.description).not.toContain("Buy");
  });

  it("sell auto-generates 'Withdraw' description for deposit assets", () => {
    const asset = assetService.create({ name: "Savings", type: "deposit", currency: "EUR" });
    lotService.buy(asset.id, { quantity: 5000, pricePerUnit: 100, date: "2026-01-01" });
    const { transaction } = lotService.sell(asset.id, {
      quantity: 1000,
      pricePerUnit: 100,
      date: "2026-03-01",
    });
    expect(transaction.description).toContain("Withdraw");
    expect(transaction.description).not.toContain("Sell");
  });

  it("sell creates a transfer transaction and negative lot", () => {
    const asset = assetService.create({ name: "BTC", type: "crypto", currency: "EUR" });
    lotService.buy(asset.id, { quantity: 1, pricePerUnit: 8000000, date: "2026-01-01" });

    const { lot, transaction } = lotService.sell(asset.id, {
      quantity: 0.3,
      pricePerUnit: 9000000,
      date: "2026-03-01",
    });

    expect(lot.quantity).toBe(-0.3);
    expect(transaction.type).toBe("transfer");
    expect(transaction.amount).toBe(2700000); // 0.3 * 9000000
  });

  it("sell throws when quantity exceeds holdings", () => {
    const asset = assetService.create({ name: "ETF", type: "investment", currency: "EUR" });
    lotService.buy(asset.id, { quantity: 5, pricePerUnit: 10000, date: "2026-01-01" });

    expect(() =>
      lotService.sell(asset.id, { quantity: 10, pricePerUnit: 10000, date: "2026-03-01" })
    ).toThrow("Insufficient");
  });

  it("sell throws for unknown asset", () => {
    expect(() =>
      lotService.sell(999, { quantity: 1, pricePerUnit: 100, date: "2026-03-01" })
    ).toThrow("not found");
  });

  // ── Regression: EUR deposit pricePerUnit guard ──────────────────────────────

  it("buy throws for EUR deposit with pricePerUnit !== 100", () => {
    const asset = assetService.create({ name: "Savings", type: "deposit", currency: "EUR" });
    expect(() =>
      lotService.buy(asset.id, { quantity: 1, pricePerUnit: 500000, date: "2026-01-01" })
    ).toThrow("pricePerUnit must be 100");
  });

  it("buy accepts EUR deposit with pricePerUnit === 100", () => {
    const asset = assetService.create({ name: "Savings", type: "deposit", currency: "EUR" });
    const { lot } = lotService.buy(asset.id, {
      quantity: 5000,
      pricePerUnit: 100,
      date: "2026-01-01",
    });
    expect(lot.quantity).toBe(5000);
    expect(lot.pricePerUnit).toBe(100);
  });

  it("buy does NOT enforce pricePerUnit for non-EUR deposits", () => {
    const asset = assetService.create({ name: "USD Account", type: "deposit", currency: "USD" });
    const { lot } = lotService.buy(asset.id, {
      quantity: 1000,
      pricePerUnit: 110,
      date: "2026-01-01",
    });
    expect(lot.pricePerUnit).toBe(110);
  });

  // ── Regression: average-cost basis after partial sell ───────────────────────

  it("currentHoldings is free of IEEE 754 float noise", () => {
    const asset = assetService.create({ name: "BTC", type: "crypto", currency: "EUR" });
    lotService.buy(asset.id, { quantity: 0.003, pricePerUnit: 8000000, date: "2026-01-01" });
    lotService.buy(asset.id, { quantity: 0.003, pricePerUnit: 8100000, date: "2026-02-01" });
    lotService.buy(asset.id, { quantity: 0.003, pricePerUnit: 8200000, date: "2026-03-01" });

    const retrieved = assetService.getById(asset.id);
    expect(retrieved?.currentHoldings).toBe(0.009);
  });

  it("costBasis (FIFO): partial sell consumes oldest lot first", () => {
    const asset = assetService.create({ name: "VWCE", type: "investment", currency: "EUR" });
    // Buy 5 at €102.50
    lotService.buy(asset.id, { quantity: 5, pricePerUnit: 10250, date: "2026-03-01" });
    // Sell 2 — FIFO consumes 2 from the single lot, remaining 3 @ €102.50
    lotService.sell(asset.id, { quantity: 2, pricePerUnit: 11200, date: "2026-03-15" });

    const retrieved = assetService.getById(asset.id);
    expect(retrieved?.currentHoldings).toBe(3);
    expect(retrieved?.costBasis).toBe(30750); // 3 * 10250
  });

  it("costBasis (FIFO): sell consumes the first buy lot, leaving second", () => {
    const asset = assetService.create({ name: "BTC", type: "crypto", currency: "EUR" });
    lotService.buy(asset.id, { quantity: 1, pricePerUnit: 8000000, date: "2026-01-01" });
    lotService.buy(asset.id, { quantity: 1, pricePerUnit: 9000000, date: "2026-02-01" });
    // Sell 1 — FIFO consumes the first lot (€80k), leaving 1 @ €90k
    lotService.sell(asset.id, { quantity: 1, pricePerUnit: 9500000, date: "2026-03-01" });

    const retrieved = assetService.getById(asset.id);
    expect(retrieved?.currentHoldings).toBe(1);
    expect(retrieved?.costBasis).toBe(9000000); // second lot remains
  });

  it("costBasis (FIFO): fully closed position then re-buy resets cost basis", () => {
    const asset = assetService.create({ name: "SPX", type: "investment", currency: "EUR" });
    // Buy 15, sell all 15, then buy 1 cheaply
    lotService.buy(asset.id, { quantity: 15, pricePerUnit: 30000, date: "2026-01-01" });
    lotService.sell(asset.id, { quantity: 15, pricePerUnit: 32000, date: "2026-01-15" });
    lotService.buy(asset.id, { quantity: 1, pricePerUnit: 2000, date: "2026-02-01" });

    const retrieved = assetService.getById(asset.id);
    expect(retrieved?.currentHoldings).toBe(1);
    expect(retrieved?.costBasis).toBe(2000); // only the new €20 lot remains
  });

  it("listLots throws for non-existent asset", () => {
    expect(() => lotService.listLots(999)).toThrow("not found");
  });

  it("listLots returns lots ordered by date descending", () => {
    const asset = assetService.create({ name: "ETF", type: "investment", currency: "EUR" });
    lotService.buy(asset.id, { quantity: 1, pricePerUnit: 10000, date: "2026-01-01" });
    lotService.buy(asset.id, { quantity: 2, pricePerUnit: 10500, date: "2026-03-01" });

    const lots = lotService.listLots(asset.id);
    expect(lots).toHaveLength(2);
    expect(lots[0].date).toBe("2026-03-01");
    expect(lots[1].date).toBe("2026-01-01");
  });
});

// ─── AssetPriceService ────────────────────────────────────────────────────────

describe("AssetPriceService", () => {
  it("record throws for non-existent asset", () => {
    expect(() =>
      priceService.record(999, { pricePerUnit: 100, recordedAt: "2026-03-20T12:00:00Z" })
    ).toThrow("not found");
  });

  it("records a user price override", () => {
    const asset = assetService.create({ name: "BTC", type: "crypto", currency: "EUR" });
    const price = priceService.record(asset.id, {
      pricePerUnit: 8000000,
      recordedAt: "2026-03-20T12:00:00Z",
    });

    expect(price.pricePerUnit).toBe(8000000);
    expect(price.assetId).toBe(asset.id);
    expect(price.recordedAt).toBe("2026-03-20T12:00:00");
  });
});

// ─── PortfolioService ─────────────────────────────────────────────────────────

describe("PortfolioService", () => {
  it("returns zero net worth when no transactions or assets", () => {
    const portfolio = portfolioService.getPortfolio();
    expect(portfolio.cashBalance).toBe(0);
    expect(portfolio.totalAssetValue).toBe(0);
    expect(portfolio.netWorth).toBe(0);
    expect(portfolio.assets).toHaveLength(0);
    expect(portfolio.pnl).toBeNull();
  });

  it("cash balance is income minus expenses, transfers excluded", () => {
    txService.create({ amount: 100000, type: "income", description: "Salary", date: "2026-03-01" });
    txService.create({ amount: 30000, type: "expense", description: "Rent", date: "2026-03-01" });
    // Transfer — should not affect cash balance
    txService.create({
      amount: 50000,
      type: "transfer",
      description: "Buy ETF",
      date: "2026-03-01",
    });

    const portfolio = portfolioService.getPortfolio();
    expect(portfolio.cashBalance).toBe(70000); // 100000 - 30000 (transfer excluded)
  });

  it("net worth includes asset values and buying is net-worth-neutral", () => {
    txService.create({ amount: 500000, type: "income", description: "Salary", date: "2026-03-01" });

    const asset = assetService.create({ name: "SPX", type: "investment", currency: "EUR" });
    // Buy 10 SPX @ €345.63 = €3,456.30 total
    lotService.buy(asset.id, { quantity: 10, pricePerUnit: 34563, date: "2026-03-01" });
    priceService.record(asset.id, { pricePerUnit: 36000, recordedAt: `${isoToday()}T10:00:00Z` });

    const portfolio = portfolioService.getPortfolio();
    // cashBalance = income − purchases = 500000 − 345630 = 154370
    expect(portfolio.cashBalance).toBe(154370);
    expect(portfolio.totalAssetValue).toBe(360000); // 10 * 36000
    // netWorth = cashBalance + assetValue = income + unrealised gain = 500000 + 14370
    expect(portfolio.netWorth).toBe(514370);
    expect(portfolio.pnl).toBe(14370); // 360000 − 345630
  });

  it("selling an asset is net-worth-neutral at the same price", () => {
    txService.create({ amount: 500000, type: "income", description: "Salary", date: "2026-03-01" });

    const asset = assetService.create({ name: "SPX", type: "investment", currency: "EUR" });
    lotService.buy(asset.id, { quantity: 10, pricePerUnit: 34563, date: "2026-03-01" });
    priceService.record(asset.id, { pricePerUnit: 34563, recordedAt: `${isoToday()}T10:00:00Z` });

    const before = portfolioService.getPortfolio();

    // Sell 4 at the same price — net worth must not change
    lotService.sell(asset.id, { quantity: 4, pricePerUnit: 34563, date: "2026-03-20" });

    const after = portfolioService.getPortfolio();
    expect(after.netWorth).toBe(before.netWorth);
    // Cash went up by the sale proceeds
    expect(after.cashBalance).toBe(before.cashBalance + 4 * 34563);
    // Asset value went down by the same amount
    expect(after.totalAssetValue).toBe(before.totalAssetValue - 4 * 34563);
  });

  it("allocation percentages sum to 100 for a single asset", () => {
    const asset = assetService.create({ name: "BTC", type: "crypto", currency: "EUR" });
    lotService.buy(asset.id, { quantity: 1, pricePerUnit: 8000000, date: "2026-03-01" });
    priceService.record(asset.id, { pricePerUnit: 9000000, recordedAt: `${isoToday()}T00:00:00Z` });

    const portfolio = portfolioService.getPortfolio();
    expect(portfolio.allocation).toHaveLength(1);
    expect(portfolio.allocation[0].pct).toBe(100);
  });
});

// ─── Opening Lots (onboarding) ──────────────────────────────────────────────

describe("AssetLotService.createOpeningLot", () => {
  it("creates a lot with no linked transaction", () => {
    const asset = assetService.create({ name: "Savings", type: "deposit", currency: "EUR" });
    const lot = lotService.createOpeningLot(asset.id, {
      quantity: 5000,
      pricePerUnit: 100,
      date: "2026-03-20",
    });
    expect(lot.id).toBeGreaterThan(0);
    expect(lot.assetId).toBe(asset.id);
    expect(lot.quantity).toBe(5000);
    expect(lot.pricePerUnit).toBe(100);
    expect(lot.transactionId).toBeNull();
  });

  it("records a price snapshot when pricePerUnit > 0", () => {
    const asset = assetService.create({ name: "BTC", type: "crypto", currency: "EUR" });
    lotService.createOpeningLot(asset.id, {
      quantity: 0.5,
      pricePerUnit: 5000000,
      date: "2026-03-20",
    });
    const updated = assetService.getById(asset.id);
    expect(updated!.latestPrice).toBe(5000000);
  });

  it("skips price snapshot when pricePerUnit is 0 but lot still used for pricing", () => {
    const asset = assetService.create({
      name: "Unknown Cost",
      type: "investment",
      currency: "EUR",
    });
    lotService.createOpeningLot(asset.id, {
      quantity: 10,
      pricePerUnit: 0,
      date: "2026-03-20",
    });
    // No price snapshot recorded, but price resolver falls back to lot pricePerUnit (0)
    const updated = assetService.getById(asset.id);
    expect(updated!.latestPrice).toBe(0);
    expect(updated!.currentValue).toBe(0);
  });

  it("throws for non-existent asset", () => {
    expect(() =>
      lotService.createOpeningLot(9999, { quantity: 1, pricePerUnit: 100, date: "2026-03-20" })
    ).toThrow("Asset 9999 not found");
  });

  it("opening lot contributes to holdings and cost basis", () => {
    const asset = assetService.create({ name: "Savings", type: "deposit", currency: "EUR" });
    lotService.createOpeningLot(asset.id, {
      quantity: 3000,
      pricePerUnit: 100,
      date: "2026-03-20",
    });
    const withMetrics = assetService.getById(asset.id);
    expect(withMetrics).not.toBeNull();
    expect(withMetrics!.currentHoldings).toBe(3000);
    expect(withMetrics!.costBasis).toBe(300000);
  });
});
