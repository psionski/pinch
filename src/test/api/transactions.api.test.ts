import { describe, it, expect, beforeEach } from "vitest";
import { setupTestServices, makeGet, makeJson, json } from "./helpers";

setupTestServices();

describe("Transaction API Routes", () => {
  let POST: (req: Request) => Promise<Response>;
  let GET: (req: Request) => Promise<Response>;
  let GET_BY_ID: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
  let PATCH: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
  let DELETE: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

  beforeEach(async () => {
    const collection = await import("@/app/api/transactions/route");
    const single = await import("@/app/api/transactions/[id]/route");
    POST = collection.POST;
    GET = collection.GET;
    GET_BY_ID = single.GET;
    PATCH = single.PATCH;
    DELETE = single.DELETE;
  });

  const ctx = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });

  it("POST creates a transaction and returns 201", async () => {
    const res = await POST(
      makeJson("POST", "/api/transactions", {
        amount: 1500,
        description: "Coffee",
        date: "2025-01-15",
        type: "expense",
      })
    );
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body).toMatchObject({ amount: 1500, description: "Coffee" });
  });

  it("POST returns 400 on invalid body", async () => {
    const res = await POST(makeJson("POST", "/api/transactions", { amount: -5 }));
    expect(res.status).toBe(400);
    const body = await json<{ code: string }>(res);
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("GET lists transactions with pagination", async () => {
    // Seed two transactions
    await POST(
      makeJson("POST", "/api/transactions", {
        amount: 1000,
        description: "A",
        date: "2025-01-01",
      })
    );
    await POST(
      makeJson("POST", "/api/transactions", {
        amount: 2000,
        description: "B",
        date: "2025-01-02",
      })
    );

    const res = await GET(makeGet("/api/transactions", { limit: "10" }));
    expect(res.status).toBe(200);
    const body = await json<{ data: unknown[]; total: number; hasMore: boolean }>(res);
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(2);
    expect(body.hasMore).toBe(false);
  });

  it("GET filters by date range", async () => {
    await POST(
      makeJson("POST", "/api/transactions", {
        amount: 1000,
        description: "Jan",
        date: "2025-01-15",
      })
    );
    await POST(
      makeJson("POST", "/api/transactions", {
        amount: 2000,
        description: "Feb",
        date: "2025-02-15",
      })
    );

    const res = await GET(
      makeGet("/api/transactions", { dateFrom: "2025-02-01", dateTo: "2025-02-28" })
    );
    const body = await json<{ data: Array<{ description: string }>; total: number }>(res);
    expect(body.total).toBe(1);
    expect(body.data[0].description).toBe("Feb");
  });

  it("GET by ID returns 404 for nonexistent", async () => {
    const res = await GET_BY_ID(makeGet("/api/transactions/999"), ctx(999));
    expect(res.status).toBe(404);
  });

  it("PATCH updates a transaction", async () => {
    const createRes = await POST(
      makeJson("POST", "/api/transactions", {
        amount: 1000,
        description: "Old",
        date: "2025-01-01",
      })
    );
    const created = await json<{ id: number }>(createRes);

    const res = await PATCH(
      makeJson("PATCH", `/api/transactions/${created.id}`, { description: "New" }),
      ctx(created.id)
    );
    expect(res.status).toBe(200);
    const body = await json<{ description: string }>(res);
    expect(body.description).toBe("New");
  });

  it("DELETE removes a transaction", async () => {
    const createRes = await POST(
      makeJson("POST", "/api/transactions", {
        amount: 1000,
        description: "Delete me",
        date: "2025-01-01",
      })
    );
    const created = await json<{ id: number }>(createRes);

    const res = await DELETE(
      makeJson("DELETE", `/api/transactions/${created.id}`),
      ctx(created.id)
    );
    expect(res.status).toBe(200);

    const getRes = await GET_BY_ID(makeGet(`/api/transactions/${created.id}`), ctx(created.id));
    expect(getRes.status).toBe(404);
  });
});
