// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "./helpers";
import { CategoryService } from "@/lib/services/categories";
import { TransactionService } from "@/lib/services/transactions";
import { CreateTransactionSchema } from "@/lib/validators/transactions";

type TestDb = ReturnType<typeof makeTestDb>;

let db: TestDb;
let categoryService: CategoryService;
let txService: TransactionService;

beforeEach(() => {
  db = makeTestDb();
  categoryService = new CategoryService(db);
  txService = new TransactionService(db);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tx(overrides: Record<string, unknown> = {}) {
  return CreateTransactionSchema.parse({
    amount: 1000,
    description: "Test transaction",
    date: "2026-03-17",
    ...overrides,
  });
}

// ─── create ───────────────────────────────────────────────────────────────────

describe("create", () => {
  it("creates a category and returns it with an id", () => {
    const cat = categoryService.create({ name: "Groceries" });
    expect(cat.id).toBeGreaterThan(0);
    expect(cat.name).toBe("Groceries");
  });

  it("creates a category with optional fields", () => {
    const cat = categoryService.create({ name: "Food", icon: "🍕", color: "#FF5733" });
    expect(cat.icon).toBe("🍕");
    expect(cat.color).toBe("#FF5733");
  });

  it("creates a child category with parentId", () => {
    const parent = categoryService.create({ name: "Food" });
    const child = categoryService.create({ name: "Groceries", parentId: parent.id });
    expect(child.parentId).toBe(parent.id);
  });

  it("throws on duplicate name", () => {
    categoryService.create({ name: "Unique" });
    expect(() => categoryService.create({ name: "Unique" })).toThrow();
  });
});

// ─── getAll ───────────────────────────────────────────────────────────────────

describe("getAll", () => {
  it("returns empty array when no categories exist", () => {
    expect(categoryService.getAll()).toEqual([]);
  });

  it("returns all categories", () => {
    categoryService.create({ name: "A" });
    categoryService.create({ name: "B" });
    categoryService.create({ name: "C" });
    expect(categoryService.getAll()).toHaveLength(3);
  });

  it("includes transactionCount for each category", () => {
    const cat = categoryService.create({ name: "Groceries" });
    txService.create(tx({ categoryId: cat.id }));
    txService.create(tx({ categoryId: cat.id }));

    const all = categoryService.getAll();
    const found = all.find((c) => c.id === cat.id);
    expect(found?.transactionCount).toBe(2);
  });

  it("returns transactionCount 0 for categories with no transactions", () => {
    const cat = categoryService.create({ name: "Empty" });
    const all = categoryService.getAll();
    const found = all.find((c) => c.id === cat.id);
    expect(found?.transactionCount).toBe(0);
  });
});

// ─── getById ──────────────────────────────────────────────────────────────────

describe("getById", () => {
  it("returns the category by id", () => {
    const created = categoryService.create({ name: "Transport" });
    const found = categoryService.getById(created.id);
    expect(found?.name).toBe("Transport");
  });

  it("returns null for non-existent id", () => {
    expect(categoryService.getById(9999)).toBeNull();
  });
});

// ─── update ───────────────────────────────────────────────────────────────────

describe("update", () => {
  it("updates the name", () => {
    const cat = categoryService.create({ name: "Old Name" });
    const updated = categoryService.update(cat.id, { name: "New Name" });
    expect(updated?.name).toBe("New Name");
  });

  it("updates icon and color", () => {
    const cat = categoryService.create({ name: "Test" });
    const updated = categoryService.update(cat.id, { icon: "🏠", color: "#AABBCC" });
    expect(updated?.icon).toBe("🏠");
    expect(updated?.color).toBe("#AABBCC");
  });

  it("clears parentId when set to null", () => {
    const parent = categoryService.create({ name: "Parent" });
    const child = categoryService.create({ name: "Child", parentId: parent.id });
    const updated = categoryService.update(child.id, { parentId: null });
    expect(updated?.parentId).toBeNull();
  });

  it("does not change fields not included in the update", () => {
    const cat = categoryService.create({ name: "Test", icon: "🎯" });
    const updated = categoryService.update(cat.id, { name: "Updated" });
    expect(updated?.icon).toBe("🎯");
  });

  it("returns null for non-existent id", () => {
    expect(categoryService.update(9999, { name: "X" })).toBeNull();
  });
});

// ─── delete ───────────────────────────────────────────────────────────────────

describe("delete", () => {
  it("deletes an existing category and returns true", () => {
    const cat = categoryService.create({ name: "ToDelete" });
    expect(categoryService.delete(cat.id)).toBe(true);
    expect(categoryService.getById(cat.id)).toBeNull();
  });

  it("returns false for non-existent id", () => {
    expect(categoryService.delete(9999)).toBe(false);
  });

  it("sets categoryId to null on associated transactions (ON DELETE SET NULL)", () => {
    const cat = categoryService.create({ name: "Food" });
    const t = txService.create(tx({ categoryId: cat.id }));
    categoryService.delete(cat.id);
    const found = txService.getById(t.id);
    expect(found?.categoryId).toBeNull();
  });

  it("sets parentId to null on child categories (ON DELETE SET NULL)", () => {
    const parent = categoryService.create({ name: "Parent" });
    const child = categoryService.create({ name: "Child", parentId: parent.id });
    categoryService.delete(parent.id);
    const foundChild = categoryService.getById(child.id);
    expect(foundChild?.parentId).toBeNull();
  });
});

// ─── recategorize ─────────────────────────────────────────────────────────────

describe("recategorize", () => {
  it("moves transactions from source to target category", () => {
    const source = categoryService.create({ name: "Source" });
    const target = categoryService.create({ name: "Target" });
    txService.create(tx({ categoryId: source.id }));
    txService.create(tx({ categoryId: source.id }));

    const count = categoryService.recategorize({
      targetCategoryId: target.id,
      sourceCategoryId: source.id,
    });

    expect(count).toBe(2);
    const sourceTxs = txService.list({
      categoryId: source.id,
      limit: 50,
      offset: 0,
      sortBy: "date",
      sortOrder: "desc",
    });
    expect(sourceTxs.total).toBe(0);
  });

  it("filters by merchant pattern", () => {
    const target = categoryService.create({ name: "Target" });
    txService.create(tx({ merchant: "ALDI" }));
    txService.create(tx({ merchant: "Lidl" }));
    txService.create(tx({ merchant: "REWE" }));

    // "LDI" appears as a substring in "ALDI" (case-insensitive LIKE); "Lidl" = L-i-d-l, no "ldi" substring
    const count = categoryService.recategorize({
      targetCategoryId: target.id,
      merchantPattern: "LDI",
    });

    expect(count).toBe(1);
  });

  it("filters by description pattern", () => {
    const target = categoryService.create({ name: "Target" });
    txService.create(tx({ description: "Weekly groceries" }));
    txService.create(tx({ description: "Monthly rent" }));
    txService.create(tx({ description: "Weekly coffee" }));

    const count = categoryService.recategorize({
      targetCategoryId: target.id,
      descriptionPattern: "Weekly",
    });

    expect(count).toBe(2);
  });

  it("filters by date range", () => {
    const target = categoryService.create({ name: "Target" });
    txService.create(tx({ date: "2026-01-15" }));
    txService.create(tx({ date: "2026-02-15" }));
    txService.create(tx({ date: "2026-03-15" }));

    const count = categoryService.recategorize({
      targetCategoryId: target.id,
      dateFrom: "2026-02-01",
      dateTo: "2026-02-28",
    });

    expect(count).toBe(1);
  });

  it("returns 0 when no transactions match the filter", () => {
    const target = categoryService.create({ name: "Target" });
    txService.create(tx({ description: "Coffee" }));

    const count = categoryService.recategorize({
      targetCategoryId: target.id,
      descriptionPattern: "nomatch12345",
    });

    expect(count).toBe(0);
  });
});

// ─── merge ────────────────────────────────────────────────────────────────────

describe("merge", () => {
  it("moves all transactions from source to target", () => {
    const source = categoryService.create({ name: "Source" });
    const target = categoryService.create({ name: "Target" });
    txService.create(tx({ categoryId: source.id, description: "A" }));
    txService.create(tx({ categoryId: source.id, description: "B" }));
    txService.create(tx({ categoryId: target.id, description: "C" }));

    categoryService.merge({ sourceCategoryId: source.id, targetCategoryId: target.id });

    const targetTxs = txService.list({
      categoryId: target.id,
      limit: 50,
      offset: 0,
      sortBy: "date",
      sortOrder: "desc",
    });
    expect(targetTxs.total).toBe(3);
  });

  it("deletes the source category", () => {
    const source = categoryService.create({ name: "Source" });
    const target = categoryService.create({ name: "Target" });

    categoryService.merge({ sourceCategoryId: source.id, targetCategoryId: target.id });

    expect(categoryService.getById(source.id)).toBeNull();
  });

  it("target category still exists after merge", () => {
    const source = categoryService.create({ name: "Source" });
    const target = categoryService.create({ name: "Target" });

    categoryService.merge({ sourceCategoryId: source.id, targetCategoryId: target.id });

    expect(categoryService.getById(target.id)).not.toBeNull();
  });

  it("no transactions remain under deleted source category", () => {
    const source = categoryService.create({ name: "Source" });
    const target = categoryService.create({ name: "Target" });
    txService.create(tx({ categoryId: source.id }));

    categoryService.merge({ sourceCategoryId: source.id, targetCategoryId: target.id });

    const sourceTxs = txService.list({
      categoryId: source.id,
      limit: 50,
      offset: 0,
      sortBy: "date",
      sortOrder: "desc",
    });
    expect(sourceTxs.total).toBe(0);
  });
});
