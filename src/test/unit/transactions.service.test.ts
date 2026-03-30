// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "../helpers";
import { TransactionService } from "@/lib/services/transactions";
import { CreateTransactionSchema, ListTransactionsSchema } from "@/lib/validators/transactions";
import { receipts, categories } from "@/lib/db/schema";

type TestDb = ReturnType<typeof makeTestDb>;

let db: TestDb;
let service: TransactionService;

beforeEach(() => {
  db = makeTestDb();
  service = new TransactionService(db);
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

function listInput(overrides: Record<string, unknown> = {}) {
  return ListTransactionsSchema.parse(overrides);
}

// ─── create ───────────────────────────────────────────────────────────────────

describe("create", () => {
  it("creates a transaction and returns it with an id", () => {
    const result = service.create(tx());
    expect(result.id).toBeGreaterThan(0);
    expect(result.amount).toBe(1000);
    expect(result.description).toBe("Test transaction");
    expect(result.type).toBe("expense");
  });

  it("parses tags from JSON to string array", () => {
    const result = service.create(tx({ tags: ["food", "daily"] }));
    expect(result.tags).toEqual(["food", "daily"]);
  });

  it("returns null tags when none provided", () => {
    const result = service.create(tx());
    expect(result.tags).toBeNull();
  });

  it("creates an income transaction", () => {
    const result = service.create(tx({ type: "income", amount: 200000 }));
    expect(result.type).toBe("income");
  });
});

// ─── createBatch ──────────────────────────────────────────────────────────────

describe("createBatch", () => {
  it("inserts all transactions in the batch", () => {
    const result = service.createBatch({
      transactions: [
        tx({ amount: 100, description: "A" }),
        tx({ amount: 200, description: "B" }),
        tx({ amount: 300, description: "C" }),
      ],
    });
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.amount)).toEqual([100, 200, 300]);
  });

  it("applies receiptId from batch-level to all items", () => {
    // Insert a real receipt to satisfy the FK constraint
    const [receipt] = db.insert(receipts).values({ date: "2026-03-17" }).returning().all();
    const result = service.createBatch({
      transactions: [tx({ amount: 500 }), tx({ amount: 600 })],
      receiptId: receipt.id,
    });
    expect(result.every((r) => r.receiptId === receipt.id)).toBe(true);
  });

  it("item-level receiptId takes precedence over batch-level", () => {
    const [r1] = db.insert(receipts).values({ date: "2026-03-17" }).returning().all();
    const [r2] = db.insert(receipts).values({ date: "2026-03-17" }).returning().all();
    const result = service.createBatch({
      transactions: [tx({ amount: 500, receiptId: r1.id })],
      receiptId: r2.id,
    });
    expect(result[0].receiptId).toBe(r1.id);
  });
});

// ─── getById ──────────────────────────────────────────────────────────────────

describe("getById", () => {
  it("returns the transaction by id", () => {
    const created = service.create(tx({ description: "Find me" }));
    const found = service.getById(created.id);
    expect(found).not.toBeNull();
    expect(found!.description).toBe("Find me");
  });

  it("returns null for non-existent id", () => {
    expect(service.getById(9999)).toBeNull();
  });
});

// ─── list — basic pagination ──────────────────────────────────────────────────

describe("list", () => {
  beforeEach(() => {
    service.create(
      tx({ amount: 100, description: "Groceries", merchant: "ALDI", date: "2026-01-10" })
    );
    service.create(
      tx({ amount: 200, description: "Coffee", merchant: "Starbucks", date: "2026-02-15" })
    );
    service.create(tx({ amount: 300, description: "Rent", date: "2026-03-01", type: "expense" }));
    service.create(tx({ amount: 500, description: "Salary", type: "income", date: "2026-03-01" }));
  });

  it("returns all transactions with correct total", () => {
    const result = service.list(listInput());
    expect(result.total).toBe(4);
    expect(result.data).toHaveLength(4);
    expect(result.hasMore).toBe(false);
  });

  it("paginates correctly", () => {
    const result = service.list(listInput({ limit: 2, offset: 0 }));
    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(4);
    expect(result.hasMore).toBe(true);
  });

  it("second page returns remaining items", () => {
    const result = service.list(listInput({ limit: 2, offset: 2 }));
    expect(result.data).toHaveLength(2);
    expect(result.hasMore).toBe(false);
  });

  it("filters by type", () => {
    const result = service.list(listInput({ type: "income" }));
    expect(result.total).toBe(1);
    expect(result.data[0].description).toBe("Salary");
  });

  it("filters by dateFrom", () => {
    const result = service.list(listInput({ dateFrom: "2026-03-01" }));
    expect(result.total).toBe(2);
  });

  it("filters by dateTo", () => {
    const result = service.list(listInput({ dateTo: "2026-01-31" }));
    expect(result.total).toBe(1);
    expect(result.data[0].description).toBe("Groceries");
  });

  it("filters by date range", () => {
    const result = service.list(listInput({ dateFrom: "2026-02-01", dateTo: "2026-02-28" }));
    expect(result.total).toBe(1);
    expect(result.data[0].description).toBe("Coffee");
  });

  it("filters by amountMin", () => {
    const result = service.list(listInput({ amountMin: 300 }));
    expect(result.total).toBe(2);
  });

  it("filters by amountMax", () => {
    const result = service.list(listInput({ amountMax: 200 }));
    expect(result.total).toBe(2);
  });

  it("filters by merchant (partial match)", () => {
    const result = service.list(listInput({ merchant: "star" }));
    expect(result.total).toBe(1);
    expect(result.data[0].merchant).toBe("Starbucks");
  });

  it("sorts by amount asc", () => {
    const result = service.list(listInput({ sortBy: "amount", sortOrder: "asc" }));
    const amounts = result.data.map((r) => r.amount);
    expect(amounts).toEqual([...amounts].sort((a, b) => a - b));
  });

  it("sorts by date desc (default)", () => {
    const result = service.list(listInput());
    const dates = result.data.map((r) => r.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});

// ─── list — categoryId filter ─────────────────────────────────────────────────

describe("list — categoryId filter", () => {
  it("filters for uncategorized transactions when categoryId is null", () => {
    const [cat] = db.insert(categories).values({ name: "Food" }).returning().all();
    service.create(tx({ description: "Categorized", categoryId: cat.id }));
    service.create(tx({ description: "Uncategorized" }));

    const result = service.list(listInput({ categoryId: null }));
    expect(result.total).toBe(1);
    expect(result.data[0].description).toBe("Uncategorized");
  });

  it("filters by a specific categoryId", () => {
    const [cat] = db.insert(categories).values({ name: "Transport" }).returning().all();
    service.create(tx({ description: "Bus", categoryId: cat.id }));
    service.create(tx({ description: "Groceries" }));

    const result = service.list(listInput({ categoryId: cat.id }));
    expect(result.total).toBe(1);
    expect(result.data[0].description).toBe("Bus");
  });

  it("includes child category transactions when filtering by parent", () => {
    const [parent] = db.insert(categories).values({ name: "Food" }).returning().all();
    const [child] = db
      .insert(categories)
      .values({ name: "Groceries", parentId: parent.id })
      .returning()
      .all();
    const [grandchild] = db
      .insert(categories)
      .values({ name: "Organic", parentId: child.id })
      .returning()
      .all();

    service.create(tx({ description: "Parent tx", categoryId: parent.id }));
    service.create(tx({ description: "Child tx", categoryId: child.id }));
    service.create(tx({ description: "Grandchild tx", categoryId: grandchild.id }));
    service.create(tx({ description: "Unrelated" }));

    const result = service.list(listInput({ categoryId: parent.id }));
    expect(result.total).toBe(3);
    const descs = result.data.map((r) => r.description).sort();
    expect(descs).toEqual(["Child tx", "Grandchild tx", "Parent tx"]);
  });
});

// ─── list — FTS search ────────────────────────────────────────────────────────

describe("list — FTS search", () => {
  beforeEach(() => {
    service.create(tx({ description: "Supermarket weekly shop", merchant: "ALDI" }));
    service.create(tx({ description: "Coffee and cake", merchant: "Bakehouse" }));
    service.create(tx({ description: "Monthly subscription", merchant: "Netflix" }));
  });

  it("finds transactions matching description keyword", () => {
    const result = service.list(listInput({ search: "supermarket" }));
    expect(result.total).toBe(1);
    expect(result.data[0].merchant).toBe("ALDI");
  });

  it("finds transactions matching merchant keyword", () => {
    const result = service.list(listInput({ search: "Netflix" }));
    expect(result.total).toBe(1);
    expect(result.data[0].description).toBe("Monthly subscription");
  });

  it("returns empty when no match", () => {
    const result = service.list(listInput({ search: "nomatch12345" }));
    expect(result.total).toBe(0);
  });

  it("finds transactions by prefix (partial word)", () => {
    const result = service.list(listInput({ search: "cof" }));
    expect(result.total).toBe(1);
    expect(result.data[0].description).toBe("Coffee and cake");
  });

  it("phrase matches consecutive words", () => {
    // "weekly shop" appears consecutively in "Supermarket weekly shop"
    const result = service.list(listInput({ search: "weekly shop" }));
    expect(result.total).toBe(1);
    expect(result.data[0].merchant).toBe("ALDI");
  });

  it("does not match words in wrong order", () => {
    // "shop weekly" is not a consecutive phrase in any description
    const result = service.list(listInput({ search: "shop weekly" }));
    expect(result.total).toBe(0);
  });

  it("prefix-matches last word in phrase", () => {
    // "weekly sho" — phrase match with prefix on last: "weekly sho"*
    const result = service.list(listInput({ search: "weekly sho" }));
    expect(result.total).toBe(1);
    expect(result.data[0].merchant).toBe("ALDI");
  });

  it("returns empty for search with only special characters", () => {
    const result = service.list(listInput({ search: "!@#" }));
    expect(result.total).toBe(0);
  });
});

// ─── list — FTS search by category name ──────────────────────────────────────

describe("list — FTS search by category name", () => {
  let catId: number;

  beforeEach(() => {
    [{ id: catId }] = db
      .insert(categories)
      .values({ name: "Groceries", icon: "cart" })
      .returning({ id: categories.id })
      .all();
    service.create(tx({ description: "Weekly shop", merchant: "ALDI", categoryId: catId }));
    service.create(tx({ description: "Coffee", merchant: "Starbucks" })); // no category
  });

  it("matches transactions by category name prefix", () => {
    const result = service.list(listInput({ search: "groc" }));
    expect(result.total).toBe(1);
    expect(result.data[0].description).toBe("Weekly shop");
  });

  it("matches transactions by full category name", () => {
    const result = service.list(listInput({ search: "Groceries" }));
    expect(result.total).toBe(1);
  });

  it("does not match uncategorized transactions for category search", () => {
    const result = service.list(listInput({ search: "Groceries" }));
    expect(result.total).toBe(1);
    expect(result.data[0].merchant).toBe("ALDI");
  });
});

// ─── list — tag filtering ─────────────────────────────────────────────────────

describe("list — tag filtering", () => {
  beforeEach(() => {
    service.create(tx({ description: "A", tags: ["food", "weekly"] }));
    service.create(tx({ description: "B", tags: ["transport"] }));
    service.create(tx({ description: "C", tags: ["food", "monthly"] }));
    service.create(tx({ description: "D" })); // no tags
  });

  it("filters by single tag", () => {
    const result = service.list(listInput({ tags: ["transport"] }));
    expect(result.total).toBe(1);
    expect(result.data[0].description).toBe("B");
  });

  it("filters by multiple tags (OR logic)", () => {
    const result = service.list(listInput({ tags: ["weekly", "monthly"] }));
    expect(result.total).toBe(2);
  });

  it("does not match transactions without any of the tags", () => {
    const result = service.list(listInput({ tags: ["food"] }));
    expect(result.total).toBe(2);
    const descs = result.data.map((r) => r.description).sort();
    expect(descs).toEqual(["A", "C"]);
  });
});

// ─── update ───────────────────────────────────────────────────────────────────

describe("update", () => {
  it("updates specified fields", () => {
    const created = service.create(tx({ amount: 100, description: "Original" }));
    const updated = service.update(created.id, { amount: 999, description: "Updated" });
    expect(updated).not.toBeNull();
    expect(updated!.amount).toBe(999);
    expect(updated!.description).toBe("Updated");
  });

  it("does not change fields not included in the update", () => {
    const created = service.create(tx({ amount: 100, merchant: "ALDI" }));
    const updated = service.update(created.id, { amount: 200 });
    expect(updated!.merchant).toBe("ALDI");
  });

  it("sets updatedAt on update", () => {
    const created = service.create(tx());
    const updated = service.update(created.id, { amount: 500 });
    expect(updated!.updatedAt).toBeDefined();
    expect(updated!.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it("clears nullable field when set to null", () => {
    const created = service.create(tx({ merchant: "ALDI" }));
    const updated = service.update(created.id, { merchant: null });
    expect(updated!.merchant).toBeNull();
  });

  it("updates tags to a new array", () => {
    const created = service.create(tx({ tags: ["old"] }));
    const updated = service.update(created.id, { tags: ["new", "tag"] });
    expect(updated!.tags).toEqual(["new", "tag"]);
  });

  it("clears tags when set to null", () => {
    const created = service.create(tx({ tags: ["food"] }));
    const updated = service.update(created.id, { tags: null });
    expect(updated!.tags).toBeNull();
  });

  it("returns null for non-existent id", () => {
    expect(service.update(9999, { amount: 100 })).toBeNull();
  });
});

// ─── delete ───────────────────────────────────────────────────────────────────

describe("delete", () => {
  it("deletes an existing transaction and returns true", () => {
    const created = service.create(tx());
    expect(service.delete(created.id)).toBe(true);
    expect(service.getById(created.id)).toBeNull();
  });

  it("returns false for non-existent id", () => {
    expect(service.delete(9999)).toBe(false);
  });
});

// ─── deleteBatch ──────────────────────────────────────────────────────────────

describe("deleteBatch", () => {
  it("deletes multiple transactions and returns count", () => {
    const a = service.create(tx({ description: "A" }));
    const b = service.create(tx({ description: "B" }));
    service.create(tx({ description: "C" }));

    const count = service.deleteBatch([a.id, b.id]);
    expect(count).toBe(2);
    expect(service.list(listInput()).total).toBe(1);
  });

  it("ignores non-existent ids gracefully", () => {
    const a = service.create(tx());
    const count = service.deleteBatch([a.id, 9999]);
    expect(count).toBe(1);
  });
});

// ─── updateBatch ──────────────────────────────────────────────────────────────

describe("updateBatch", () => {
  it("updates multiple transactions in one call", () => {
    const [cat] = db.insert(categories).values({ name: "Food" }).returning().all();
    const a = service.create(tx({ description: "A" }));
    const b = service.create(tx({ description: "B" }));

    const results = service.updateBatch({
      updates: [
        { id: a.id, categoryId: cat.id },
        { id: b.id, description: "B updated" },
      ],
    });

    expect(results).toHaveLength(2);
    expect(results.find((r) => r.id === a.id)?.categoryId).toBe(cat.id);
    expect(results.find((r) => r.id === b.id)?.description).toBe("B updated");
  });

  it("silently skips non-existent ids and returns only updated rows", () => {
    const a = service.create(tx({ description: "A" }));

    const results = service.updateBatch({
      updates: [
        { id: a.id, description: "A updated" },
        { id: 9999, description: "Ghost" },
      ],
    });

    expect(results).toHaveLength(1);
    expect(results[0].description).toBe("A updated");
  });

  it("is atomic — all updates succeed or none do", () => {
    const a = service.create(tx({ description: "A" }));
    const b = service.create(tx({ description: "B" }));

    expect(() =>
      service.updateBatch({
        updates: [
          { id: a.id, categoryId: 9999 }, // invalid FK — will throw
          { id: b.id, description: "B updated" },
        ],
      })
    ).toThrow();

    // neither row should be changed
    expect(service.getById(a.id)?.categoryId).toBeNull();
    expect(service.getById(b.id)?.description).toBe("B");
  });
});

// ─── listTags ─────────────────────────────────────────────────────────────────

describe("listTags", () => {
  it("returns empty array when no tags exist", () => {
    service.create(tx());
    expect(service.listTags()).toEqual([]);
  });

  it("returns distinct tags sorted alphabetically", () => {
    service.create(tx({ tags: ["food", "weekly"] }));
    service.create(tx({ tags: ["transport", "food"] }));
    service.create(tx()); // no tags
    const tags = service.listTags();
    expect(tags).toEqual(["food", "transport", "weekly"]);
  });

  it("deduplicates tags that appear in multiple transactions", () => {
    service.create(tx({ tags: ["food"] }));
    service.create(tx({ tags: ["food"] }));
    expect(service.listTags()).toEqual(["food"]);
  });
});

describe("transfer type", () => {
  it("creates a transfer transaction successfully", () => {
    const result = service.create(tx({ amount: 50000, type: "transfer", description: "Buy SPX" }));
    expect(result.type).toBe("transfer");
    expect(result.amount).toBe(50000);
  });

  it("excludes transfers by default, includes with explicit type filter", () => {
    service.create(tx({ type: "expense" }));
    service.create(tx({ type: "transfer", description: "Asset purchase" }));

    const all = service.list(ListTransactionsSchema.parse({}));
    expect(all.total).toBe(1); // transfers excluded by default

    const transfers = service.list(ListTransactionsSchema.parse({ type: "transfer" }));
    expect(transfers.total).toBe(1);
    expect(transfers.data[0].type).toBe("transfer");
  });
});
