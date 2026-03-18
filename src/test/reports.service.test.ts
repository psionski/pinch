// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "./helpers";
import { ReportService } from "@/lib/services/reports";
import { TransactionService } from "@/lib/services/transactions";
import { CategoryService } from "@/lib/services/categories";
import { CreateTransactionSchema } from "@/lib/validators/transactions";
import {
  SpendingSummarySchema,
  CategoryBreakdownSchema,
  TrendsSchema,
  TopMerchantsSchema,
} from "@/lib/validators/reports";

type TestDb = ReturnType<typeof makeTestDb>;

let db: TestDb;
let reports: ReportService;
let txService: TransactionService;
let catService: CategoryService;

beforeEach(() => {
  db = makeTestDb();
  reports = new ReportService(db);
  txService = new TransactionService(db);
  catService = new CategoryService(db);
});

function tx(overrides: Record<string, unknown> = {}) {
  return CreateTransactionSchema.parse({
    amount: 1000,
    description: "Test",
    date: "2026-03-01",
    ...overrides,
  });
}

// ─── spendingSummary ──────────────────────────────────────────────────────────

describe("spendingSummary", () => {
  beforeEach(() => {
    const food = catService.create({ name: "Food" });
    const transport = catService.create({ name: "Transport" });

    txService.create(
      tx({ amount: 500, date: "2026-03-05", categoryId: food.id, merchant: "ALDI" })
    );
    txService.create(
      tx({ amount: 300, date: "2026-03-10", categoryId: food.id, merchant: "Lidl" })
    );
    txService.create(
      tx({ amount: 200, date: "2026-03-15", categoryId: transport.id, merchant: "BVG" })
    );
    txService.create(
      tx({ amount: 1000, date: "2026-02-28", categoryId: food.id, merchant: "ALDI" })
    );
  });

  it("returns correct period total for date range", () => {
    const result = reports.spendingSummary(
      SpendingSummarySchema.parse({ dateFrom: "2026-03-01", dateTo: "2026-03-31" })
    );
    expect(result.period.total).toBe(1000);
    expect(result.period.count).toBe(3);
  });

  it("groups by category correctly", () => {
    const result = reports.spendingSummary(
      SpendingSummarySchema.parse({
        dateFrom: "2026-03-01",
        dateTo: "2026-03-31",
        groupBy: "category",
      })
    );
    expect(result.groups).toHaveLength(2);
    const food = result.groups.find((g) => g.key === "Food");
    expect(food?.total).toBe(800);
    expect(food?.count).toBe(2);
  });

  it("groups by month correctly", () => {
    const result = reports.spendingSummary(
      SpendingSummarySchema.parse({
        dateFrom: "2026-02-01",
        dateTo: "2026-03-31",
        groupBy: "month",
      })
    );
    expect(result.groups).toHaveLength(2);
    const march = result.groups.find((g) => g.key === "2026-03");
    expect(march?.total).toBe(1000);
  });

  it("groups by merchant correctly", () => {
    const result = reports.spendingSummary(
      SpendingSummarySchema.parse({
        dateFrom: "2026-03-01",
        dateTo: "2026-03-31",
        groupBy: "merchant",
      })
    );
    const aldi = result.groups.find((g) => g.key === "ALDI");
    expect(aldi?.total).toBe(500);
  });

  it("includes compareTotal when compare period is provided", () => {
    const result = reports.spendingSummary(
      SpendingSummarySchema.parse({
        dateFrom: "2026-03-01",
        dateTo: "2026-03-31",
        groupBy: "category",
        compareDateFrom: "2026-02-01",
        compareDateTo: "2026-02-28",
      })
    );
    const food = result.groups.find((g) => g.key === "Food");
    expect(food?.compareTotal).toBe(1000);
    expect(result.comparePeriod?.total).toBe(1000);
  });

  it("includes compareTotal when grouped by month", () => {
    const result = reports.spendingSummary(
      SpendingSummarySchema.parse({
        dateFrom: "2026-03-01",
        dateTo: "2026-03-31",
        groupBy: "month",
        compareDateFrom: "2026-02-01",
        compareDateTo: "2026-02-28",
      })
    );
    const march = result.groups.find((g) => g.key === "2026-03");
    // No March data in compare period, so compareTotal should be 0
    expect(march?.compareTotal).toBe(0);
    // Compare period should have Feb data
    expect(result.comparePeriod?.total).toBe(1000);
  });

  it("includes compareTotal when grouped by merchant", () => {
    const result = reports.spendingSummary(
      SpendingSummarySchema.parse({
        dateFrom: "2026-03-01",
        dateTo: "2026-03-31",
        groupBy: "merchant",
        compareDateFrom: "2026-02-01",
        compareDateTo: "2026-02-28",
      })
    );
    const aldi = result.groups.find((g) => g.key === "ALDI");
    // ALDI had 1000 in Feb
    expect(aldi?.compareTotal).toBe(1000);
    // Lidl had nothing in Feb
    const lidl = result.groups.find((g) => g.key === "Lidl");
    expect(lidl?.compareTotal).toBe(0);
  });

  it("respects type filter (income vs expense)", () => {
    txService.create(
      tx({ amount: 5000, type: "income", date: "2026-03-20", description: "Salary" })
    );
    const expense = reports.spendingSummary(
      SpendingSummarySchema.parse({ dateFrom: "2026-03-01", dateTo: "2026-03-31", type: "expense" })
    );
    expect(expense.period.total).toBe(1000);

    const income = reports.spendingSummary(
      SpendingSummarySchema.parse({ dateFrom: "2026-03-01", dateTo: "2026-03-31", type: "income" })
    );
    expect(income.period.total).toBe(5000);
  });
});

// ─── categoryBreakdown ────────────────────────────────────────────────────────

describe("categoryBreakdown", () => {
  it("returns percentages that sum to 100", () => {
    const food = catService.create({ name: "Food" });
    const transport = catService.create({ name: "Transport" });
    txService.create(tx({ amount: 750, categoryId: food.id }));
    txService.create(tx({ amount: 250, categoryId: transport.id }));

    const result = reports.categoryBreakdown(
      CategoryBreakdownSchema.parse({ dateFrom: "2026-03-01", dateTo: "2026-03-31" })
    );
    const total = result.reduce((s, r) => s + r.percentage, 0);
    expect(Math.round(total)).toBe(100);
    const food_ = result.find((r) => r.categoryId === food.id);
    expect(food_?.percentage).toBe(75);
  });

  it("returns empty array when no transactions", () => {
    const result = reports.categoryBreakdown(
      CategoryBreakdownSchema.parse({ dateFrom: "2026-03-01", dateTo: "2026-03-31" })
    );
    expect(result).toHaveLength(0);
  });

  it("groups uncategorized transactions under null category", () => {
    txService.create(tx({ amount: 500 })); // no categoryId
    const result = reports.categoryBreakdown(
      CategoryBreakdownSchema.parse({ dateFrom: "2026-03-01", dateTo: "2026-03-31" })
    );
    expect(result).toHaveLength(1);
    expect(result[0].categoryId).toBeNull();
    expect(result[0].percentage).toBe(100);
  });
});

// ─── trends ───────────────────────────────────────────────────────────────────

describe("trends", () => {
  it("returns N month data points", () => {
    const result = reports.trends(TrendsSchema.parse({ months: 3 }));
    expect(result).toHaveLength(3);
  });

  it("returns 6 months by default", () => {
    const result = reports.trends(TrendsSchema.parse({}));
    expect(result).toHaveLength(6);
  });

  it("sums transactions correctly for each month", () => {
    txService.create(tx({ amount: 100, date: "2026-03-01" }));
    txService.create(tx({ amount: 200, date: "2026-03-15" }));
    txService.create(tx({ amount: 50, date: "2026-02-10" }));

    const result = reports.trends(TrendsSchema.parse({ months: 6 }));
    const march = result.find((r) => r.month === "2026-03");
    const feb = result.find((r) => r.month === "2026-02");
    expect(march?.total).toBe(300);
    expect(march?.count).toBe(2);
    expect(feb?.total).toBe(50);
  });

  it("filters by categoryId when provided", () => {
    const food = catService.create({ name: "Food" });
    txService.create(tx({ amount: 500, categoryId: food.id, date: "2026-03-01" }));
    txService.create(tx({ amount: 200, date: "2026-03-01" })); // different category

    const result = reports.trends(TrendsSchema.parse({ months: 3, categoryId: food.id }));
    const march = result.find((r) => r.month === "2026-03");
    expect(march?.total).toBe(500);
  });

  it("months are returned in ascending order", () => {
    const result = reports.trends(TrendsSchema.parse({ months: 4 }));
    const months = result.map((r) => r.month);
    expect(months).toEqual([...months].sort());
  });
});

// ─── netBalance ──────────────────────────────────────────────────────────────

describe("netBalance", () => {
  it("returns zero when no transactions exist", () => {
    const result = reports.netBalance({});
    expect(result.totalIncome).toBe(0);
    expect(result.totalExpenses).toBe(0);
    expect(result.netBalance).toBe(0);
    expect(result.transactionCount).toBe(0);
  });

  it("calculates income minus expenses", () => {
    txService.create(
      tx({ amount: 5000, type: "income", date: "2026-03-01", description: "Salary" })
    );
    txService.create(tx({ amount: 1200, type: "expense", date: "2026-03-05" }));
    txService.create(tx({ amount: 800, type: "expense", date: "2026-03-10" }));

    const result = reports.netBalance({});
    expect(result.totalIncome).toBe(5000);
    expect(result.totalExpenses).toBe(2000);
    expect(result.netBalance).toBe(3000);
    expect(result.transactionCount).toBe(3);
  });

  it("filters by date range", () => {
    txService.create(
      tx({ amount: 5000, type: "income", date: "2026-03-01", description: "Salary" })
    );
    txService.create(tx({ amount: 1000, type: "expense", date: "2026-03-15" }));
    txService.create(tx({ amount: 2000, type: "expense", date: "2026-04-01" }));

    const result = reports.netBalance({ dateFrom: "2026-03-01", dateTo: "2026-03-31" });
    expect(result.totalIncome).toBe(5000);
    expect(result.totalExpenses).toBe(1000);
    expect(result.netBalance).toBe(4000);
    expect(result.transactionCount).toBe(2);
  });

  it("works with only dateFrom", () => {
    txService.create(tx({ amount: 500, type: "expense", date: "2026-02-15" }));
    txService.create(tx({ amount: 300, type: "expense", date: "2026-03-15" }));

    const result = reports.netBalance({ dateFrom: "2026-03-01" });
    expect(result.totalExpenses).toBe(300);
    expect(result.transactionCount).toBe(1);
  });

  it("works with only dateTo", () => {
    txService.create(tx({ amount: 500, type: "expense", date: "2026-02-15" }));
    txService.create(tx({ amount: 300, type: "expense", date: "2026-03-15" }));

    const result = reports.netBalance({ dateTo: "2026-02-28" });
    expect(result.totalExpenses).toBe(500);
    expect(result.transactionCount).toBe(1);
  });

  it("returns negative balance when expenses exceed income", () => {
    txService.create(
      tx({ amount: 1000, type: "income", date: "2026-03-01", description: "Salary" })
    );
    txService.create(tx({ amount: 3000, type: "expense", date: "2026-03-05" }));

    const result = reports.netBalance({});
    expect(result.netBalance).toBe(-2000);
  });
});

// ─── topMerchants ─────────────────────────────────────────────────────────────

describe("topMerchants", () => {
  beforeEach(() => {
    txService.create(tx({ amount: 1000, merchant: "ALDI", date: "2026-03-01" }));
    txService.create(tx({ amount: 500, merchant: "ALDI", date: "2026-03-05" }));
    txService.create(tx({ amount: 800, merchant: "Lidl", date: "2026-03-10" }));
    txService.create(tx({ amount: 300, date: "2026-03-15" })); // no merchant
  });

  it("returns merchants sorted by total descending", () => {
    const result = reports.topMerchants(
      TopMerchantsSchema.parse({ dateFrom: "2026-03-01", dateTo: "2026-03-31" })
    );
    expect(result[0].merchant).toBe("ALDI");
    expect(result[0].total).toBe(1500);
    expect(result[0].count).toBe(2);
  });

  it("excludes transactions without a merchant", () => {
    const result = reports.topMerchants(
      TopMerchantsSchema.parse({ dateFrom: "2026-03-01", dateTo: "2026-03-31" })
    );
    expect(result.every((r) => r.merchant !== null)).toBe(true);
    expect(result).toHaveLength(2);
  });

  it("respects the limit parameter", () => {
    const result = reports.topMerchants(
      TopMerchantsSchema.parse({ dateFrom: "2026-03-01", dateTo: "2026-03-31", limit: 1 })
    );
    expect(result).toHaveLength(1);
    expect(result[0].merchant).toBe("ALDI");
  });

  it("computes avgAmount correctly", () => {
    const result = reports.topMerchants(
      TopMerchantsSchema.parse({ dateFrom: "2026-03-01", dateTo: "2026-03-31" })
    );
    const aldi = result.find((r) => r.merchant === "ALDI");
    expect(aldi?.avgAmount).toBe(750); // (1000 + 500) / 2
  });
});
