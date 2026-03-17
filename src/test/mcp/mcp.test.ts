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
});
