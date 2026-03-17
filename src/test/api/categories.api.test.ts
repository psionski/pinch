import { describe, it, expect, beforeEach } from "vitest";
import { setupTestServices, makeGet, makeJson, json } from "./helpers";

setupTestServices();

describe("Category API Routes", () => {
  let POST: (req: Request) => Promise<Response>;
  let GET: () => Promise<Response>;
  let GET_BY_ID: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
  let PATCH: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
  let DELETE: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
  let RECATEGORIZE: (req: Request) => Promise<Response>;
  let MERGE: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    const collection = await import("@/app/api/categories/route");
    const single = await import("@/app/api/categories/[id]/route");
    const recat = await import("@/app/api/categories/recategorize/route");
    const merge = await import("@/app/api/categories/merge/route");
    POST = collection.POST;
    GET = collection.GET;
    GET_BY_ID = single.GET;
    PATCH = single.PATCH;
    DELETE = single.DELETE;
    RECATEGORIZE = recat.POST;
    MERGE = merge.POST;
  });

  const ctx = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });

  it("POST creates a category and returns 201", async () => {
    const res = await POST(makeJson("POST", "/api/categories", { name: "Food" }));
    expect(res.status).toBe(201);
    const body = await json<{ name: string }>(res);
    expect(body.name).toBe("Food");
  });

  it("POST returns 409 on duplicate name", async () => {
    await POST(makeJson("POST", "/api/categories", { name: "Food" }));
    const res = await POST(makeJson("POST", "/api/categories", { name: "Food" }));
    expect(res.status).toBe(409);
  });

  it("GET lists all categories", async () => {
    await POST(makeJson("POST", "/api/categories", { name: "A" }));
    await POST(makeJson("POST", "/api/categories", { name: "B" }));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await json<unknown[]>(res);
    expect(body).toHaveLength(2);
  });

  it("PATCH updates a category", async () => {
    const createRes = await POST(makeJson("POST", "/api/categories", { name: "Old" }));
    const created = await json<{ id: number }>(createRes);

    const res = await PATCH(
      makeJson("PATCH", `/api/categories/${created.id}`, { name: "New" }),
      ctx(created.id)
    );
    expect(res.status).toBe(200);
    const body = await json<{ name: string }>(res);
    expect(body.name).toBe("New");
  });

  it("DELETE removes a category", async () => {
    const createRes = await POST(makeJson("POST", "/api/categories", { name: "Del" }));
    const created = await json<{ id: number }>(createRes);

    const res = await DELETE(makeJson("DELETE", `/api/categories/${created.id}`), ctx(created.id));
    expect(res.status).toBe(200);

    const getRes = await GET_BY_ID(makeGet(`/api/categories/${created.id}`), ctx(created.id));
    expect(getRes.status).toBe(404);
  });

  it("POST /recategorize moves transactions", async () => {
    // Create categories
    const catA = await json<{ id: number }>(
      await POST(makeJson("POST", "/api/categories", { name: "A" }))
    );
    const catB = await json<{ id: number }>(
      await POST(makeJson("POST", "/api/categories", { name: "B" }))
    );

    // Create transaction in category A
    const txRoute = await import("@/app/api/transactions/route");
    await txRoute.POST(
      makeJson("POST", "/api/transactions", {
        amount: 1000,
        description: "Test",
        date: "2025-01-01",
        categoryId: catA.id,
      })
    );

    const res = await RECATEGORIZE(
      makeJson("POST", "/api/categories/recategorize", {
        sourceCategoryId: catA.id,
        targetCategoryId: catB.id,
      })
    );
    expect(res.status).toBe(200);
    const body = await json<{ updated: number }>(res);
    expect(body.updated).toBe(1);
  });

  it("POST /merge merges categories", async () => {
    const catA = await json<{ id: number }>(
      await POST(makeJson("POST", "/api/categories", { name: "Source" }))
    );
    const catB = await json<{ id: number }>(
      await POST(makeJson("POST", "/api/categories", { name: "Target" }))
    );

    const res = await MERGE(
      makeJson("POST", "/api/categories/merge", {
        sourceCategoryId: catA.id,
        targetCategoryId: catB.id,
      })
    );
    expect(res.status).toBe(200);

    // Source should be deleted
    const getRes = await GET_BY_ID(makeGet(`/api/categories/${catA.id}`), ctx(catA.id));
    expect(getRes.status).toBe(404);
  });
});
