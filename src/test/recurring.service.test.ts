// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "./helpers";
import { RecurringService, computeNextOccurrence } from "@/lib/services/recurring";
import { TransactionService } from "@/lib/services/transactions";
import { CategoryService } from "@/lib/services/categories";
import { CreateRecurringSchema } from "@/lib/validators/recurring";
import { recurringTransactions } from "@/lib/db/schema";

type TestDb = ReturnType<typeof makeTestDb>;

let db: TestDb;
let service: RecurringService;
let txService: TransactionService;

beforeEach(() => {
  db = makeTestDb();
  service = new RecurringService(db);
  txService = new TransactionService(db);
  new CategoryService(db);
});

function rec(overrides: Record<string, unknown> = {}) {
  return CreateRecurringSchema.parse({
    amount: 1000,
    description: "Test recurring",
    frequency: "monthly",
    startDate: "2026-01-01",
    ...overrides,
  });
}

// ─── computeNextOccurrence ────────────────────────────────────────────────────

describe("computeNextOccurrence", () => {
  function makeRow(overrides: Partial<(typeof recurringTransactions)["$inferInsert"]> = {}) {
    return {
      id: 1,
      amount: 1000,
      type: "expense" as const,
      description: "Test",
      merchant: null,
      categoryId: null,
      frequency: "monthly" as const,
      dayOfMonth: null,
      dayOfWeek: null,
      startDate: "2026-01-15",
      endDate: null,
      lastGenerated: null,
      isActive: 1,
      notes: null,
      tags: null,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
      ...overrides,
    };
  }

  it("returns null when inactive", () => {
    const r = makeRow({ isActive: 0 });
    expect(computeNextOccurrence(r, new Date("2026-03-01"))).toBeNull();
  });

  it("returns null when endDate is in the past", () => {
    const r = makeRow({ endDate: "2026-02-01" });
    expect(computeNextOccurrence(r, new Date("2026-03-01"))).toBeNull();
  });

  it("monthly: returns next occurrence on the same day of month", () => {
    const r = makeRow({ startDate: "2026-01-15", frequency: "monthly" });
    expect(computeNextOccurrence(r, new Date("2026-03-01"))).toBe("2026-03-15");
  });

  it("monthly: uses dayOfMonth when specified", () => {
    const r = makeRow({ startDate: "2026-01-01", frequency: "monthly", dayOfMonth: 20 });
    expect(computeNextOccurrence(r, new Date("2026-03-01"))).toBe("2026-03-20");
  });

  it("monthly: advances to next month when current day has passed", () => {
    const r = makeRow({ startDate: "2026-01-05", frequency: "monthly" });
    expect(computeNextOccurrence(r, new Date("2026-03-10"))).toBe("2026-04-05");
  });

  it("weekly: returns correct day of week", () => {
    // dayOfWeek 1 = Monday
    const r = makeRow({ startDate: "2026-01-01", frequency: "weekly", dayOfWeek: 1 });
    // 2026-03-16 is a Monday
    const result = computeNextOccurrence(r, new Date("2026-03-15"));
    expect(result).toBe("2026-03-16");
  });

  it("daily: returns next day", () => {
    const r = makeRow({ startDate: "2026-01-01", frequency: "daily" });
    expect(computeNextOccurrence(r, new Date("2026-03-15"))).toBe("2026-03-16");
  });

  it("yearly: returns same month/day next year when past", () => {
    const r = makeRow({ startDate: "2026-01-10", frequency: "yearly" });
    expect(computeNextOccurrence(r, new Date("2026-01-11"))).toBe("2027-01-10");
  });

  it("yearly: returns this year's occurrence when not yet passed", () => {
    const r = makeRow({ startDate: "2026-06-15", frequency: "yearly" });
    expect(computeNextOccurrence(r, new Date("2026-03-01"))).toBe("2026-06-15");
  });

  it("returns null for unknown frequency", () => {
    const r = makeRow({ frequency: "biweekly" as "monthly" });
    expect(computeNextOccurrence(r, new Date("2026-03-01"))).toBeNull();
  });

  it("monthly: handles cursor before startDate", () => {
    const r = makeRow({ startDate: "2026-06-15", frequency: "monthly" });
    // cursor is before startDate — first occurrence should be the startDate itself
    expect(computeNextOccurrence(r, new Date("2026-01-01"))).toBe("2026-06-15");
  });
});

// ─── create ───────────────────────────────────────────────────────────────────

describe("create", () => {
  it("creates a recurring template and returns it", () => {
    const result = service.create(rec());
    expect(result.id).toBeGreaterThan(0);
    expect(result.amount).toBe(1000);
    expect(result.frequency).toBe("monthly");
    expect(result.isActive).toBe(1);
  });

  it("parses tags from JSON to string array", () => {
    const result = service.create(rec({ tags: ["bills", "fixed"] }));
    expect(result.tags).toEqual(["bills", "fixed"]);
  });

  it("includes nextOccurrence", () => {
    const result = service.create(rec({ startDate: "2026-01-15" }));
    expect(result.nextOccurrence).not.toBeNull();
  });
});

// ─── list ─────────────────────────────────────────────────────────────────────

describe("list", () => {
  it("returns all recurring templates", () => {
    service.create(rec({ description: "Netflix" }));
    service.create(rec({ description: "Gym" }));
    expect(service.list()).toHaveLength(2);
  });

  it("returns empty array when none exist", () => {
    expect(service.list()).toHaveLength(0);
  });
});

// ─── update ───────────────────────────────────────────────────────────────────

describe("update", () => {
  it("updates specified fields", () => {
    const created = service.create(rec({ amount: 1000 }));
    const updated = service.update(created.id, { amount: 2000, description: "Updated" });
    expect(updated).not.toBeNull();
    expect(updated!.amount).toBe(2000);
    expect(updated!.description).toBe("Updated");
  });

  it("deactivates a recurring template", () => {
    const created = service.create(rec());
    const updated = service.update(created.id, { isActive: false });
    expect(updated!.isActive).toBe(0);
    expect(updated!.nextOccurrence).toBeNull();
  });

  it("returns null for non-existent id", () => {
    expect(service.update(9999, { amount: 100 })).toBeNull();
  });
});

// ─── delete ───────────────────────────────────────────────────────────────────

describe("delete", () => {
  it("deletes a recurring template and returns true", () => {
    const created = service.create(rec());
    expect(service.delete(created.id)).toBe(true);
    expect(service.getById(created.id)).toBeNull();
  });

  it("returns false for non-existent id", () => {
    expect(service.delete(9999)).toBe(false);
  });

  it("keeps generated transactions after deleting the template", () => {
    const created = service.create(rec({ startDate: "2026-01-01" }));
    txService.create({
      amount: 1000,
      type: "expense",
      description: "Auto-generated",
      date: "2026-02-01",
      recurringId: created.id,
    });

    service.delete(created.id);

    const allTx = txService.list({ limit: 50, offset: 0, sortBy: "date", sortOrder: "asc" });
    expect(allTx.total).toBe(1);
    expect(allTx.data[0].description).toBe("Auto-generated");
  });
});

// ─── generatePending ──────────────────────────────────────────────────────────

describe("generatePending", () => {
  it("generates monthly transactions up to the given date", () => {
    service.create(rec({ startDate: "2026-01-15", frequency: "monthly" }));

    const count = service.generatePending("2026-04-30");
    expect(count).toBeGreaterThanOrEqual(3); // Jan-15, Feb-15, Mar-15, Apr-15

    const txs = txService.list({ limit: 50, offset: 0, sortBy: "date", sortOrder: "asc" });
    const dates = txs.data.map((t) => t.date);
    expect(dates).toContain("2026-01-15");
    expect(dates).toContain("2026-02-15");
    expect(dates).toContain("2026-03-15");
    expect(dates).toContain("2026-04-15");
  });

  it("does not generate past lastGenerated", () => {
    service.create(rec({ startDate: "2026-01-15", frequency: "monthly" }));
    // First run: generates up to March
    service.generatePending("2026-03-31");
    const firstCount = txService.list({
      limit: 50,
      offset: 0,
      sortBy: "date",
      sortOrder: "asc",
    }).total;

    // Second run with same date: should not create duplicates
    service.generatePending("2026-03-31");
    const secondCount = txService.list({
      limit: 50,
      offset: 0,
      sortBy: "date",
      sortOrder: "asc",
    }).total;

    expect(secondCount).toBe(firstCount);
  });

  it("generates daily transactions", () => {
    service.create(rec({ startDate: "2026-03-01", frequency: "daily" }));
    const count = service.generatePending("2026-03-07");
    expect(count).toBe(7);
  });

  it("generates weekly transactions", () => {
    // Monday start: 2026-03-02 is a Monday
    service.create(rec({ startDate: "2026-03-02", frequency: "weekly" }));
    const count = service.generatePending("2026-03-30");
    // Mondays: Mar 2, 9, 16, 23, 30 = 5
    expect(count).toBe(5);
  });

  it("generates yearly transactions", () => {
    service.create(rec({ startDate: "2024-03-01", frequency: "yearly" }));
    const count = service.generatePending("2026-12-31");
    // 2024-03-01, 2025-03-01, 2026-03-01 = 3
    expect(count).toBe(3);
  });

  it("respects endDate — does not generate past it", () => {
    service.create(rec({ startDate: "2026-01-15", frequency: "monthly", endDate: "2026-02-28" }));
    const count = service.generatePending("2026-06-30");
    expect(count).toBe(2); // Jan-15 and Feb-15 only
  });

  it("skips inactive templates", () => {
    service.create(rec({ startDate: "2026-01-15", frequency: "monthly" }));
    const created = service.list()[0];
    service.update(created.id, { isActive: false });

    const count = service.generatePending("2026-06-30");
    expect(count).toBe(0);
  });

  it("links generated transactions to the recurring template via recurringId", () => {
    const r = service.create(rec({ startDate: "2026-03-01", frequency: "monthly" }));
    service.generatePending("2026-03-31");

    const txs = txService.list({
      limit: 50,
      offset: 0,
      sortBy: "date",
      sortOrder: "asc",
      recurringId: r.id,
    });
    expect(txs.total).toBe(1);
    expect(txs.data[0].recurringId).toBe(r.id);
  });

  it("returns 0 when no active templates exist", () => {
    const count = service.generatePending("2026-12-31");
    expect(count).toBe(0);
  });
});
