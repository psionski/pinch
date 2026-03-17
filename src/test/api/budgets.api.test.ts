import { describe, it, expect, beforeEach } from "vitest";
import { setupTestServices, makeGet, makeJson, json } from "./helpers";

setupTestServices();

describe("Budget API Routes", () => {
  let POST_BUDGET: (req: Request) => Promise<Response>;
  let GET_BUDGET: (req: Request) => Promise<Response>;
  let POST_CATEGORY: (req: Request) => Promise<Response>;
  let POST_TX: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    const budgets = await import("@/app/api/budgets/route");
    const cats = await import("@/app/api/categories/route");
    const txs = await import("@/app/api/transactions/route");
    POST_BUDGET = budgets.POST;
    GET_BUDGET = budgets.GET;
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
});
