import { describe, it, expect, beforeEach } from "vitest";
import { setupTestServices, makeGet, makeJson, json } from "./helpers";

setupTestServices();

describe("Budget API Routes", () => {
  let POST_BUDGET: (req: Request) => Promise<Response>;
  let GET_BUDGET: (req: Request) => Promise<Response>;
  let DELETE_BUDGET: (req: Request) => Promise<Response>;
  let POST_COPY: (req: Request) => Promise<Response>;
  let GET_HISTORY: (req: Request) => Promise<Response>;
  let POST_CATEGORY: (req: Request) => Promise<Response>;
  let POST_TX: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    const budgets = await import("@/app/api/budgets/route");
    const copy = await import("@/app/api/budgets/copy/route");
    const history = await import("@/app/api/budgets/history/route");
    const cats = await import("@/app/api/categories/route");
    const txs = await import("@/app/api/transactions/route");
    POST_BUDGET = budgets.POST;
    GET_BUDGET = budgets.GET;
    DELETE_BUDGET = budgets.DELETE;
    POST_COPY = copy.POST;
    GET_HISTORY = history.GET;
    POST_CATEGORY = cats.POST;
    POST_TX = txs.POST;
  });

  it("POST sets a budget and returns 201", async () => {
    const cat = await json<{ id: number }>(
      await POST_CATEGORY(makeJson("POST", "/api/categories", { name: "Food" }))
    );
    const res = await POST_BUDGET(
      makeJson("POST", "/api/budgets", {
        categoryId: cat.id,
        month: "2025-01",
        amount: 50000,
      })
    );
    expect(res.status).toBe(201);
    const body = await json<{ amount: number }>(res);
    expect(body.amount).toBe(50000);
  });

  it("GET returns budget status for a month", async () => {
    const cat = await json<{ id: number }>(
      await POST_CATEGORY(makeJson("POST", "/api/categories", { name: "Food" }))
    );
    await POST_BUDGET(
      makeJson("POST", "/api/budgets", {
        categoryId: cat.id,
        month: "2025-01",
        amount: 50000,
      })
    );
    // Add a transaction
    await POST_TX(
      makeJson("POST", "/api/transactions", {
        amount: 15000,
        description: "Groceries",
        date: "2025-01-15",
        categoryId: cat.id,
        type: "expense",
      })
    );

    const res = await GET_BUDGET(makeGet("/api/budgets", { month: "2025-01" }));
    expect(res.status).toBe(200);
    const body = await json<Array<{ budgetAmount: number; spentAmount: number }>>(res);
    expect(body).toHaveLength(1);
    expect(body[0].budgetAmount).toBe(50000);
    expect(body[0].spentAmount).toBe(15000);
  });

  it("DELETE removes a budget and returns success", async () => {
    const cat = await json<{ id: number }>(
      await POST_CATEGORY(makeJson("POST", "/api/categories", { name: "Food" }))
    );
    await POST_BUDGET(
      makeJson("POST", "/api/budgets", {
        categoryId: cat.id,
        month: "2025-01",
        amount: 50000,
      })
    );

    const res = await DELETE_BUDGET(
      makeGet("/api/budgets", { categoryId: String(cat.id), month: "2025-01" })
    );
    expect(res.status).toBe(200);
    const body = await json<{ success: boolean }>(res);
    expect(body.success).toBe(true);

    // Verify it's gone
    const status = await json<unknown[]>(
      await GET_BUDGET(makeGet("/api/budgets", { month: "2025-01" }))
    );
    expect(status).toHaveLength(0);
  });

  it("DELETE returns 404 for non-existent budget", async () => {
    const res = await DELETE_BUDGET(
      makeGet("/api/budgets", { categoryId: "999", month: "2025-01" })
    );
    expect(res.status).toBe(404);
  });

  it("POST /copy copies budgets from one month to another", async () => {
    const cat1 = await json<{ id: number }>(
      await POST_CATEGORY(makeJson("POST", "/api/categories", { name: "Food" }))
    );
    const cat2 = await json<{ id: number }>(
      await POST_CATEGORY(makeJson("POST", "/api/categories", { name: "Transport" }))
    );
    await POST_BUDGET(
      makeJson("POST", "/api/budgets", { categoryId: cat1.id, month: "2025-01", amount: 50000 })
    );
    await POST_BUDGET(
      makeJson("POST", "/api/budgets", { categoryId: cat2.id, month: "2025-01", amount: 30000 })
    );

    const res = await POST_COPY(
      makeJson("POST", "/api/budgets/copy", { fromMonth: "2025-01", toMonth: "2025-02" })
    );
    expect(res.status).toBe(200);
    const body = await json<{ copied: number }>(res);
    expect(body.copied).toBe(2);

    // Verify target month has budgets
    const status = await json<unknown[]>(
      await GET_BUDGET(makeGet("/api/budgets", { month: "2025-02" }))
    );
    expect(status).toHaveLength(2);
  });

  it("GET /history returns budget vs actual for recent months", async () => {
    const cat = await json<{ id: number }>(
      await POST_CATEGORY(makeJson("POST", "/api/categories", { name: "Food" }))
    );
    await POST_BUDGET(
      makeJson("POST", "/api/budgets", { categoryId: cat.id, month: "2025-01", amount: 50000 })
    );
    await POST_TX(
      makeJson("POST", "/api/transactions", {
        amount: 20000,
        description: "Groceries",
        date: "2025-01-15",
        categoryId: cat.id,
        type: "expense",
      })
    );

    const res = await GET_HISTORY(makeGet("/api/budgets/history", { months: "3" }));
    expect(res.status).toBe(200);
    const body = await json<{ month: string; totalBudget: number; totalSpent: number }[]>(res);
    expect(body).toHaveLength(3);
    // Each point should have the expected shape
    for (const point of body) {
      expect(point).toHaveProperty("month");
      expect(point).toHaveProperty("totalBudget");
      expect(point).toHaveProperty("totalSpent");
      expect(point).toHaveProperty("percentUsed");
    }
  });
});
