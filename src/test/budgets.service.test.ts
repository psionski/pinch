// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "./helpers";
import { BudgetService } from "@/lib/services/budgets";
import { CategoryService } from "@/lib/services/categories";
import { TransactionService } from "@/lib/services/transactions";
import {
  SetBudgetSchema,
  GetBudgetStatusSchema,
  CopyBudgetsSchema,
} from "@/lib/validators/budgets";
import { CreateTransactionSchema } from "@/lib/validators/transactions";

type TestDb = ReturnType<typeof makeTestDb>;

let db: TestDb;
let budgetService: BudgetService;
let catService: CategoryService;
let txService: TransactionService;

let foodId: number;
let transportId: number;

beforeEach(() => {
  db = makeTestDb();
  budgetService = new BudgetService(db);
  catService = new CategoryService(db);
  txService = new TransactionService(db);

  foodId = catService.create({ name: "Food" }).id;
  transportId = catService.create({ name: "Transport" }).id;
});

function tx(overrides: Record<string, unknown> = {}) {
  return CreateTransactionSchema.parse({
    amount: 1000,
    description: "Test",
    date: "2026-03-15",
    ...overrides,
  });
}

// ─── set ──────────────────────────────────────────────────────────────────────

describe("set", () => {
  it("creates a new budget", () => {
    const result = budgetService.set(
      SetBudgetSchema.parse({ categoryId: foodId, month: "2026-03", amount: 50000 })
    );
    expect(result.id).toBeGreaterThan(0);
    expect(result.amount).toBe(50000);
    expect(result.month).toBe("2026-03");
  });

  it("updates an existing budget for the same category+month", () => {
    budgetService.set(
      SetBudgetSchema.parse({ categoryId: foodId, month: "2026-03", amount: 50000 })
    );
    const updated = budgetService.set(
      SetBudgetSchema.parse({ categoryId: foodId, month: "2026-03", amount: 60000 })
    );
    expect(updated.amount).toBe(60000);
    // Should not create a second row
    expect(budgetService.listForCategory(foodId)).toHaveLength(1);
  });

  it("applies to future months when applyToFutureMonths is true", () => {
    budgetService.set(
      SetBudgetSchema.parse({ categoryId: foodId, month: "2026-04", amount: 40000 })
    );
    budgetService.set(
      SetBudgetSchema.parse({ categoryId: foodId, month: "2026-05", amount: 40000 })
    );
    budgetService.set(
      SetBudgetSchema.parse({
        categoryId: foodId,
        month: "2026-03",
        amount: 55000,
        applyToFutureMonths: true,
      })
    );

    const rows = budgetService.listForCategory(foodId);
    // 2026-03, 2026-04, 2026-05 should all have 55000
    expect(rows.every((r) => r.amount === 55000)).toBe(true);
  });
});

// ─── getForMonth ──────────────────────────────────────────────────────────────

describe("getForMonth", () => {
  beforeEach(() => {
    budgetService.set(
      SetBudgetSchema.parse({ categoryId: foodId, month: "2026-03", amount: 50000 })
    );
    budgetService.set(
      SetBudgetSchema.parse({ categoryId: transportId, month: "2026-03", amount: 20000 })
    );

    // Spend 30000 on food in March
    txService.create(
      tx({ amount: 20000, categoryId: foodId, type: "expense", date: "2026-03-05" })
    );
    txService.create(
      tx({ amount: 10000, categoryId: foodId, type: "expense", date: "2026-03-20" })
    );
    // Spend 25000 on transport (over budget)
    txService.create(
      tx({ amount: 25000, categoryId: transportId, type: "expense", date: "2026-03-10" })
    );
    // Income should not count against budget
    txService.create(tx({ amount: 5000, categoryId: foodId, type: "income", date: "2026-03-15" }));
  });

  it("returns budget status for all categories in the month", () => {
    const result = budgetService.getForMonth(GetBudgetStatusSchema.parse({ month: "2026-03" }));
    expect(result).toHaveLength(2);
  });

  it("calculates spentAmount correctly (expense only)", () => {
    const result = budgetService.getForMonth(GetBudgetStatusSchema.parse({ month: "2026-03" }));
    const food = result.find((r) => r.categoryName === "Food");
    expect(food?.spentAmount).toBe(30000);
    expect(food?.budgetAmount).toBe(50000);
    expect(food?.remainingAmount).toBe(20000);
    expect(food?.isOver).toBe(false);
  });

  it("marks over-budget categories correctly", () => {
    const result = budgetService.getForMonth(GetBudgetStatusSchema.parse({ month: "2026-03" }));
    const transport = result.find((r) => r.categoryName === "Transport");
    expect(transport?.isOver).toBe(true);
    expect(transport?.remainingAmount).toBe(-5000);
    expect(transport?.percentUsed).toBeGreaterThan(100);
  });

  it("returns 0 spentAmount for categories with no transactions", () => {
    const other = catService.create({ name: "Other" });
    budgetService.set(
      SetBudgetSchema.parse({ categoryId: other.id, month: "2026-03", amount: 10000 })
    );
    const result = budgetService.getForMonth(GetBudgetStatusSchema.parse({ month: "2026-03" }));
    const otherStatus = result.find((r) => r.categoryName === "Other");
    expect(otherStatus?.spentAmount).toBe(0);
    expect(otherStatus?.isOver).toBe(false);
  });

  it("does not include transactions from other months", () => {
    txService.create(
      tx({ amount: 99999, categoryId: foodId, type: "expense", date: "2026-02-28" })
    );
    const result = budgetService.getForMonth(GetBudgetStatusSchema.parse({ month: "2026-03" }));
    const food = result.find((r) => r.categoryName === "Food");
    expect(food?.spentAmount).toBe(30000);
  });
});

// ─── copyFromPreviousMonth ────────────────────────────────────────────────────

describe("copyFromPreviousMonth", () => {
  it("copies all budgets from source month to target month", () => {
    budgetService.set(
      SetBudgetSchema.parse({ categoryId: foodId, month: "2026-02", amount: 50000 })
    );
    budgetService.set(
      SetBudgetSchema.parse({ categoryId: transportId, month: "2026-02", amount: 20000 })
    );

    const count = budgetService.copyFromPreviousMonth(
      CopyBudgetsSchema.parse({ fromMonth: "2026-02", toMonth: "2026-03" })
    );
    expect(count).toBe(2);

    const marchStatus = budgetService.getForMonth(
      GetBudgetStatusSchema.parse({ month: "2026-03" })
    );
    expect(marchStatus).toHaveLength(2);
    const food = marchStatus.find((r) => r.categoryName === "Food");
    expect(food?.budgetAmount).toBe(50000);
  });

  it("overwrites existing budget in target month", () => {
    budgetService.set(
      SetBudgetSchema.parse({ categoryId: foodId, month: "2026-02", amount: 60000 })
    );
    budgetService.set(
      SetBudgetSchema.parse({ categoryId: foodId, month: "2026-03", amount: 10000 })
    );

    budgetService.copyFromPreviousMonth(
      CopyBudgetsSchema.parse({ fromMonth: "2026-02", toMonth: "2026-03" })
    );

    const status = budgetService.getForMonth(GetBudgetStatusSchema.parse({ month: "2026-03" }));
    const food = status.find((r) => r.categoryName === "Food");
    expect(food?.budgetAmount).toBe(60000);
  });

  it("returns 0 when source month has no budgets", () => {
    const count = budgetService.copyFromPreviousMonth(
      CopyBudgetsSchema.parse({ fromMonth: "2025-01", toMonth: "2026-03" })
    );
    expect(count).toBe(0);
  });
});

// ─── delete ───────────────────────────────────────────────────────────────────

describe("delete", () => {
  it("deletes a budget and returns true", () => {
    budgetService.set(
      SetBudgetSchema.parse({ categoryId: foodId, month: "2026-03", amount: 50000 })
    );
    expect(budgetService.delete(foodId, "2026-03")).toBe(true);
    expect(budgetService.listForCategory(foodId)).toHaveLength(0);
  });

  it("returns false for non-existent budget", () => {
    expect(budgetService.delete(foodId, "2026-03")).toBe(false);
  });
});
