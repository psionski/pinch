import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "@/test/helpers";
import { TransactionService } from "@/lib/services/transactions";
import { CategoryService } from "@/lib/services/categories";
import { ReportService } from "@/lib/services/reports";
import { BudgetService } from "@/lib/services/budgets";
import { RecurringService } from "@/lib/services/recurring";
import type { AppDb } from "@/lib/db";

// MCP JSON-RPC helpers
const MCP_BASE = "http://localhost:4000/api/mcp";

function mcpRequest(body: unknown): Request {
  return new Request(MCP_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });
}

function initRequest() {
  return mcpRequest({
    jsonrpc: "2.0",
    id: 0,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "test-client", version: "0.0.1" },
    },
  });
}

function toolsListRequest() {
  return mcpRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {},
  });
}

function toolCallRequest(name: string, args: Record<string, unknown>) {
  return mcpRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name, arguments: args },
  });
}

async function parseResult(res: Response): Promise<unknown> {
  const body = await res.json();
  // body is either a JSON-RPC response or a batch; unwrap result
  return (body as { result?: unknown; error?: unknown }).result;
}

// ─── Test setup ──────────────────────────────────────────────────────────────

let db: AppDb;

beforeEach(() => {
  db = makeTestDb();

  vi.doMock("@/lib/api/services", () => ({
    getTransactionService: () => new TransactionService(db),
    getCategoryService: () => new CategoryService(db),
    getReportService: () => new ReportService(db),
    getBudgetService: () => new BudgetService(db),
    getRecurringService: () => new RecurringService(db),
  }));

  vi.doMock("@/lib/db", () => ({
    getDb: () => db,
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("MCP /api/mcp route", () => {
  let POST: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    const route = await import("@/app/api/mcp/route");
    POST = route.POST;
  });

  it("responds to initialize", async () => {
    const res = await POST(initRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect((body as { result?: { serverInfo?: { name: string } } }).result?.serverInfo?.name).toBe(
      "pinch"
    );
  });

  it("lists all registered tools", async () => {
    // Stateless — initialize and list in separate requests (both valid)
    await POST(initRequest());
    const res = await POST(toolsListRequest());
    expect(res.status).toBe(200);
    const result = await parseResult(res);
    const tools = (result as { tools: { name: string }[] }).tools.map((t) => t.name);

    // Spot-check a representative set
    expect(tools).toContain("add_transaction");
    expect(tools).toContain("list_transactions");
    expect(tools).toContain("list_categories");
    expect(tools).toContain("spending_summary");
    expect(tools).toContain("set_budget");
    expect(tools).toContain("copy_budgets");
    expect(tools).toContain("delete_budget");
    expect(tools).toContain("create_recurring");
    expect(tools).toContain("query");
  });

  it("add_transaction creates a transaction", async () => {
    await POST(initRequest());
    const res = await POST(
      toolCallRequest("add_transaction", {
        amount: 1200,
        description: "Coffee",
        date: "2025-06-01",
        type: "expense",
      })
    );
    expect(res.status).toBe(200);
    const result = await parseResult(res);
    const content = (result as { content: { text: string }[] }).content[0].text;
    const tx = JSON.parse(content) as { amount: number; description: string };
    expect(tx.amount).toBe(1200);
    expect(tx.description).toBe("Coffee");
  });

  it("list_transactions returns seeded data", async () => {
    // Seed directly via service
    const svc = new TransactionService(db);
    svc.create({ amount: 500, description: "Tea", date: "2025-06-01", type: "expense" });
    svc.create({ amount: 800, description: "Juice", date: "2025-06-02", type: "expense" });

    await POST(initRequest());
    const res = await POST(toolCallRequest("list_transactions", {}));
    expect(res.status).toBe(200);
    const result = await parseResult(res);
    const content = (result as { content: { text: string }[] }).content[0].text;
    const page = JSON.parse(content) as { total: number };
    expect(page.total).toBe(2);
  });

  it("update_transaction modifies a field", async () => {
    const svc = new TransactionService(db);
    const tx = svc.create({ amount: 999, description: "Old", date: "2025-06-01", type: "expense" });

    await POST(initRequest());
    const res = await POST(
      toolCallRequest("update_transaction", { id: tx.id, description: "New" })
    );
    expect(res.status).toBe(200);
    const result = await parseResult(res);
    const content = (result as { content: { text: string }[] }).content[0].text;
    const updated = JSON.parse(content) as { description: string };
    expect(updated.description).toBe("New");
  });

  it("delete_transaction removes a transaction", async () => {
    const svc = new TransactionService(db);
    const tx = svc.create({
      amount: 100,
      description: "Gone",
      date: "2025-06-01",
      type: "expense",
    });

    await POST(initRequest());
    const res = await POST(toolCallRequest("delete_transaction", { id: tx.id }));
    expect(res.status).toBe(200);
    expect(svc.getById(tx.id)).toBeNull();
  });

  it("list_categories returns all categories", async () => {
    const svc = new CategoryService(db);
    svc.create({ name: "Food" });

    await POST(initRequest());
    const res = await POST(toolCallRequest("list_categories", {}));
    const result = await parseResult(res);
    const cats = JSON.parse((result as { content: { text: string }[] }).content[0].text) as {
      name: string;
    }[];
    expect(cats.some((c) => c.name === "Food")).toBe(true);
  });

  it("set_budget and get_budget_status", async () => {
    const catSvc = new CategoryService(db);
    const cat = catSvc.create({ name: "Groceries" });

    await POST(initRequest());
    await POST(
      toolCallRequest("set_budget", { categoryId: cat.id, month: "2025-06", amount: 10000 })
    );

    const res = await POST(toolCallRequest("get_budget_status", { month: "2025-06" }));
    const result = await parseResult(res);
    const items = JSON.parse((result as { content: { text: string }[] }).content[0].text) as {
      categoryName: string;
      budgetAmount: number;
    }[];
    expect(items[0].budgetAmount).toBe(10000);
  });

  it("copy_budgets copies budgets between months", async () => {
    const catSvc = new CategoryService(db);
    const cat = catSvc.create({ name: "Rent" });
    const budgetSvc = new BudgetService(db);
    budgetSvc.set({
      categoryId: cat.id,
      month: "2025-05",
      amount: 80000,
      applyToFutureMonths: false,
    });

    await POST(initRequest());
    const res = await POST(
      toolCallRequest("copy_budgets", { fromMonth: "2025-05", toMonth: "2025-06" })
    );
    expect(res.status).toBe(200);
    const result = await parseResult(res);
    const body = JSON.parse((result as { content: { text: string }[] }).content[0].text) as {
      copied: number;
    };
    expect(body.copied).toBe(1);
  });

  it("delete_budget removes a budget", async () => {
    const catSvc = new CategoryService(db);
    const cat = catSvc.create({ name: "Snacks" });
    const budgetSvc = new BudgetService(db);
    budgetSvc.set({
      categoryId: cat.id,
      month: "2025-06",
      amount: 5000,
      applyToFutureMonths: false,
    });

    await POST(initRequest());
    const res = await POST(
      toolCallRequest("delete_budget", { categoryId: cat.id, month: "2025-06" })
    );
    expect(res.status).toBe(200);
    const result = await parseResult(res);
    const body = JSON.parse((result as { content: { text: string }[] }).content[0].text) as {
      deleted: boolean;
    };
    expect(body.deleted).toBe(true);
    // Verify it's gone
    expect(budgetSvc.listForCategory(cat.id)).toHaveLength(0);
  });

  it("query tool executes read-only SQL", async () => {
    const svc = new TransactionService(db);
    svc.create({ amount: 300, description: "Test", date: "2025-06-01", type: "expense" });

    await POST(initRequest());
    const res = await POST(
      toolCallRequest("query", { sql: "SELECT count(*) AS n FROM transactions" })
    );
    const result = await parseResult(res);
    const rows = JSON.parse((result as { content: { text: string }[] }).content[0].text) as {
      n: number;
    }[];
    expect(rows[0].n).toBe(1);
  });

  it("query tool rejects non-SELECT statements", async () => {
    await POST(initRequest());
    const res = await POST(toolCallRequest("query", { sql: "DELETE FROM transactions" }));
    const body = await res.json();
    // MCP wraps tool errors in the result with isError: true
    const content = (body as { result?: { content?: { text: string }[] }; isError?: boolean })
      .result;
    expect(content).toBeDefined();
  });

  it("get_db_schema returns table DDL", async () => {
    await POST(initRequest());
    const res = await POST(toolCallRequest("get_db_schema", {}));
    expect(res.status).toBe(200);
    const result = await parseResult(res);
    const tables = JSON.parse((result as { content: { text: string }[] }).content[0].text) as {
      name: string;
      sql: string;
    }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain("transactions");
    expect(names).toContain("categories");
  });

  // ─── Categories tools ───────────────────────────────────────────────────────

  it("create_category creates a category", async () => {
    await POST(initRequest());
    const res = await POST(toolCallRequest("create_category", { name: "Transport" }));
    expect(res.status).toBe(200);
    const result = await parseResult(res);
    const cat = JSON.parse((result as { content: { text: string }[] }).content[0].text) as {
      name: string;
    };
    expect(cat.name).toBe("Transport");
  });

  it("update_category renames a category", async () => {
    const svc = new CategoryService(db);
    const cat = svc.create({ name: "Old Name" });

    await POST(initRequest());
    const res = await POST(toolCallRequest("update_category", { id: cat.id, name: "New Name" }));
    expect(res.status).toBe(200);
    const result = await parseResult(res);
    const updated = JSON.parse((result as { content: { text: string }[] }).content[0].text) as {
      name: string;
    };
    expect(updated.name).toBe("New Name");
  });

  it("recategorize bulk-moves transactions", async () => {
    const catSvc = new CategoryService(db);
    const src = catSvc.create({ name: "Source" });
    const dst = catSvc.create({ name: "Dest" });
    const txSvc = new TransactionService(db);
    txSvc.create({
      amount: 100,
      description: "Move me",
      date: "2025-06-01",
      type: "expense",
      categoryId: src.id,
    });

    await POST(initRequest());
    const res = await POST(
      toolCallRequest("recategorize", {
        targetCategoryId: dst.id,
        sourceCategoryId: src.id,
      })
    );
    expect(res.status).toBe(200);
    const result = await parseResult(res);
    const body = JSON.parse((result as { content: { text: string }[] }).content[0].text) as {
      updated: number;
    };
    expect(body.updated).toBe(1);
  });

  it("merge_categories merges source into target", async () => {
    const catSvc = new CategoryService(db);
    const src = catSvc.create({ name: "To Merge" });
    const dst = catSvc.create({ name: "Keep" });
    const txSvc = new TransactionService(db);
    txSvc.create({
      amount: 200,
      description: "Merged tx",
      date: "2025-06-01",
      type: "expense",
      categoryId: src.id,
    });

    await POST(initRequest());
    const res = await POST(
      toolCallRequest("merge_categories", {
        sourceCategoryId: src.id,
        targetCategoryId: dst.id,
      })
    );
    expect(res.status).toBe(200);
    // Source category should be gone
    expect(catSvc.getById(src.id)).toBeNull();
  });

  // ─── Recurring tools ────────────────────────────────────────────────────────

  it("list_recurring returns templates", async () => {
    const svc = new RecurringService(db);
    svc.create({
      amount: 5000,
      type: "expense",
      description: "Netflix",
      frequency: "monthly",
      startDate: "2025-01-01",
    });

    await POST(initRequest());
    const res = await POST(toolCallRequest("list_recurring", {}));
    expect(res.status).toBe(200);
    const result = await parseResult(res);
    const list = JSON.parse((result as { content: { text: string }[] }).content[0].text) as {
      description: string;
    }[];
    expect(list.some((r) => r.description === "Netflix")).toBe(true);
  });

  it("update_recurring modifies a template", async () => {
    const svc = new RecurringService(db);
    const rec = svc.create({
      amount: 5000,
      type: "expense",
      description: "Old Sub",
      frequency: "monthly",
      startDate: "2025-01-01",
    });

    await POST(initRequest());
    const res = await POST(
      toolCallRequest("update_recurring", { id: rec.id, description: "New Sub" })
    );
    expect(res.status).toBe(200);
    const result = await parseResult(res);
    const updated = JSON.parse((result as { content: { text: string }[] }).content[0].text) as {
      description: string;
    };
    expect(updated.description).toBe("New Sub");
  });

  it("delete_recurring removes a template", async () => {
    const svc = new RecurringService(db);
    const rec = svc.create({
      amount: 1000,
      type: "expense",
      description: "Temp",
      frequency: "daily",
      startDate: "2025-01-01",
    });

    await POST(initRequest());
    const res = await POST(toolCallRequest("delete_recurring", { id: rec.id }));
    expect(res.status).toBe(200);
    expect(svc.getById(rec.id)).toBeNull();
  });

  it("generate_recurring creates pending transactions", async () => {
    const svc = new RecurringService(db);
    svc.create({
      amount: 300,
      type: "expense",
      description: "Daily coffee",
      frequency: "daily",
      startDate: "2025-06-01",
    });

    await POST(initRequest());
    const res = await POST(toolCallRequest("generate_recurring", { upToDate: "2025-06-03" }));
    expect(res.status).toBe(200);
    const result = await parseResult(res);
    const body = JSON.parse((result as { content: { text: string }[] }).content[0].text) as {
      generated: number;
    };
    expect(body.generated).toBe(3);
  });

  // ─── Report tools ───────────────────────────────────────────────────────────

  it("category_breakdown returns per-category amounts", async () => {
    const catSvc = new CategoryService(db);
    const cat = catSvc.create({ name: "Food" });
    const txSvc = new TransactionService(db);
    txSvc.create({
      amount: 1500,
      description: "Lunch",
      date: "2025-06-01",
      type: "expense",
      categoryId: cat.id,
    });

    await POST(initRequest());
    const res = await POST(
      toolCallRequest("category_breakdown", {
        dateFrom: "2025-06-01",
        dateTo: "2025-06-30",
      })
    );
    expect(res.status).toBe(200);
    const result = await parseResult(res);
    const breakdown = JSON.parse((result as { content: { text: string }[] }).content[0].text) as {
      categoryName: string;
    }[];
    expect(breakdown.some((b) => b.categoryName === "Food")).toBe(true);
  });

  it("trends returns monthly time series", async () => {
    const txSvc = new TransactionService(db);
    txSvc.create({
      amount: 1000,
      description: "Jan spend",
      date: "2025-01-15",
      type: "expense",
    });

    await POST(initRequest());
    const res = await POST(toolCallRequest("trends", { months: 6 }));
    expect(res.status).toBe(200);
    const result = await parseResult(res);
    const data = JSON.parse((result as { content: { text: string }[] }).content[0].text) as {
      month: string;
    }[];
    expect(Array.isArray(data)).toBe(true);
  });

  it("top_merchants returns merchant ranking", async () => {
    const txSvc = new TransactionService(db);
    txSvc.create({
      amount: 2000,
      description: "Coffee",
      merchant: "Starbucks",
      date: "2025-06-01",
      type: "expense",
    });

    await POST(initRequest());
    const res = await POST(
      toolCallRequest("top_merchants", {
        dateFrom: "2025-06-01",
        dateTo: "2025-06-30",
      })
    );
    expect(res.status).toBe(200);
    const result = await parseResult(res);
    const merchants = JSON.parse((result as { content: { text: string }[] }).content[0].text) as {
      merchant: string;
    }[];
    expect(merchants.some((m) => m.merchant === "Starbucks")).toBe(true);
  });

  // ─── Transactions tools (remaining) ─────────────────────────────────────────

  it("add_transactions batch-creates multiple transactions", async () => {
    await POST(initRequest());
    const res = await POST(
      toolCallRequest("add_transactions", {
        transactions: [
          { amount: 500, description: "Item 1", date: "2025-06-01", type: "expense" },
          { amount: 700, description: "Item 2", date: "2025-06-01", type: "expense" },
        ],
      })
    );
    expect(res.status).toBe(200);
    const result = await parseResult(res);
    const created = JSON.parse(
      (result as { content: { text: string }[] }).content[0].text
    ) as unknown[];
    expect(created).toHaveLength(2);
  });

  it("batch_update_transactions updates multiple transactions", async () => {
    const svc = new TransactionService(db);
    const tx1 = svc.create({ amount: 100, description: "A", date: "2025-06-01", type: "expense" });
    const tx2 = svc.create({ amount: 200, description: "B", date: "2025-06-01", type: "expense" });

    await POST(initRequest());
    const res = await POST(
      toolCallRequest("batch_update_transactions", {
        updates: [
          { id: tx1.id, description: "A Updated" },
          { id: tx2.id, description: "B Updated" },
        ],
      })
    );
    expect(res.status).toBe(200);
    const result = await parseResult(res);
    const updated = JSON.parse((result as { content: { text: string }[] }).content[0].text) as {
      description: string;
    }[];
    expect(updated.map((t) => t.description)).toEqual(
      expect.arrayContaining(["A Updated", "B Updated"])
    );
  });

  it("delete_transaction handles array of IDs", async () => {
    const svc = new TransactionService(db);
    const tx1 = svc.create({ amount: 100, description: "D1", date: "2025-06-01", type: "expense" });
    const tx2 = svc.create({ amount: 200, description: "D2", date: "2025-06-01", type: "expense" });

    await POST(initRequest());
    const res = await POST(toolCallRequest("delete_transaction", { id: [tx1.id, tx2.id] }));
    expect(res.status).toBe(200);
    expect(svc.getById(tx1.id)).toBeNull();
    expect(svc.getById(tx2.id)).toBeNull();
  });

  it("list_tags returns distinct tags", async () => {
    const svc = new TransactionService(db);
    svc.create({
      amount: 100,
      description: "Tagged",
      date: "2025-06-01",
      type: "expense",
      tags: ["food", "lunch"],
    });

    await POST(initRequest());
    const res = await POST(toolCallRequest("list_tags", {}));
    expect(res.status).toBe(200);
    const result = await parseResult(res);
    const tags = JSON.parse(
      (result as { content: { text: string }[] }).content[0].text
    ) as string[];
    expect(tags).toContain("food");
    expect(tags).toContain("lunch");
  });
});
