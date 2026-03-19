// @vitest-environment node
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { makeTestDb } from "./helpers";
import { ReceiptService } from "@/lib/services/receipts";
import { transactions } from "@/lib/db/schema";

// Mock fs operations — we don't want to write real files in tests
vi.mock("fs", () => ({
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() => Buffer.from("fake-image")),
}));

type TestDb = ReturnType<typeof makeTestDb>;

let db: TestDb;
let service: ReceiptService;

beforeEach(() => {
  db = makeTestDb();
  service = new ReceiptService(db);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── upload ───────────────────────────────────────────────────────────────────

describe("upload", () => {
  it("creates a receipt row and returns it with an id", () => {
    const result = service.upload(Buffer.from("img"), ".jpg", { date: "2026-03-01" });
    expect(result.id).toBeGreaterThan(0);
    expect(result.date).toBe("2026-03-01");
  });

  it("populates imageUrl based on the receipt id", () => {
    const result = service.upload(Buffer.from("img"), ".jpg", { date: "2026-03-01" });
    expect(result.imageUrl).toBe(`/api/receipts/${result.id}/image`);
  });

  it("stores merchant and total when provided", () => {
    const result = service.upload(Buffer.from("img"), ".png", {
      date: "2026-03-01",
      merchant: "Lidl",
      total: 4320,
    });
    expect(result.merchant).toBe("Lidl");
    expect(result.total).toBe(4320);
  });

  it("uses today's date when none is provided", () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = service.upload(Buffer.from("img"), ".jpg", {});
    expect(result.date).toBe(today);
  });
});

// ─── getById ──────────────────────────────────────────────────────────────────

describe("getById", () => {
  it("returns the receipt by id", () => {
    const created = service.upload(Buffer.from("img"), ".jpg", { date: "2026-03-01" });
    const found = service.getById(created.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);
  });

  it("returns null for a non-existent id", () => {
    expect(service.getById(99999)).toBeNull();
  });

  it("returns imageUrl when the receipt has an image", () => {
    const created = service.upload(Buffer.from("img"), ".jpg", { date: "2026-03-01" });
    const found = service.getById(created.id);
    expect(found?.imageUrl).toBe(`/api/receipts/${created.id}/image`);
  });
});

// ─── listUnprocessed ──────────────────────────────────────────────────────────

describe("listUnprocessed", () => {
  it("returns receipts that have no linked transactions", () => {
    service.upload(Buffer.from("img"), ".jpg", { date: "2026-03-01" });
    service.upload(Buffer.from("img"), ".jpg", { date: "2026-03-02" });
    const result = service.listUnprocessed({ limit: 50, offset: 0 });
    expect(result.total).toBe(2);
    expect(result.data).toHaveLength(2);
  });

  it("excludes receipts that have at least one linked transaction", () => {
    const r1 = service.upload(Buffer.from("img"), ".jpg", { date: "2026-03-01" });
    const r2 = service.upload(Buffer.from("img"), ".jpg", { date: "2026-03-02" });

    // Link a transaction to r1
    db.insert(transactions)
      .values({
        amount: 1000,
        type: "expense",
        description: "Linked tx",
        date: "2026-03-01",
        receiptId: r1.id,
      })
      .run();

    const result = service.listUnprocessed({ limit: 50, offset: 0 });
    expect(result.total).toBe(1);
    expect(result.data[0].id).toBe(r2.id);
  });

  it("returns empty when all receipts are processed", () => {
    const r = service.upload(Buffer.from("img"), ".jpg", { date: "2026-03-01" });
    db.insert(transactions)
      .values({
        amount: 500,
        type: "expense",
        description: "Linked tx",
        date: "2026-03-01",
        receiptId: r.id,
      })
      .run();

    const result = service.listUnprocessed({ limit: 50, offset: 0 });
    expect(result.total).toBe(0);
    expect(result.data).toHaveLength(0);
  });

  it("respects pagination", () => {
    service.upload(Buffer.from("img"), ".jpg", { date: "2026-03-01" });
    service.upload(Buffer.from("img"), ".jpg", { date: "2026-03-02" });
    service.upload(Buffer.from("img"), ".jpg", { date: "2026-03-03" });

    const page1 = service.listUnprocessed({ limit: 2, offset: 0 });
    expect(page1.data).toHaveLength(2);
    expect(page1.hasMore).toBe(true);

    const page2 = service.listUnprocessed({ limit: 2, offset: 2 });
    expect(page2.data).toHaveLength(1);
    expect(page2.hasMore).toBe(false);
  });
});
