import { describe, it, expect, beforeEach } from "vitest";
import { setupTestServices, makeGet, makeJson, json } from "./helpers";

setupTestServices();

describe("Recurring API Routes", () => {
  let POST_REC: (req: Request) => Promise<Response>;
  let GET_REC: () => Promise<Response>;
  let GET_BY_ID: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
  let PATCH: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
  let DELETE: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
  let GENERATE: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    const collection = await import("@/app/api/recurring/route");
    const single = await import("@/app/api/recurring/[id]/route");
    const gen = await import("@/app/api/recurring/generate/route");
    POST_REC = collection.POST;
    GET_REC = collection.GET;
    GET_BY_ID = single.GET;
    PATCH = single.PATCH;
    DELETE = single.DELETE;
    GENERATE = gen.POST;
  });

  const ctx = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });

  it("POST creates a recurring template", async () => {
    const res = await POST_REC(
      makeJson("POST", "/api/recurring", {
        amount: 999,
        description: "Netflix",
        frequency: "monthly",
        startDate: "2025-01-01",
        dayOfMonth: 1,
      })
    );
    expect(res.status).toBe(201);
    const body = await json<{ description: string; frequency: string }>(res);
    expect(body.description).toBe("Netflix");
    expect(body.frequency).toBe("monthly");
  });

  it("GET lists all recurring templates", async () => {
    await POST_REC(
      makeJson("POST", "/api/recurring", {
        amount: 999,
        description: "Netflix",
        frequency: "monthly",
        startDate: "2025-01-01",
      })
    );
    const res = await GET_REC();
    expect(res.status).toBe(200);
    const body = await json<unknown[]>(res);
    expect(body).toHaveLength(1);
  });

  it("PATCH updates a recurring template", async () => {
    const createRes = await POST_REC(
      makeJson("POST", "/api/recurring", {
        amount: 999,
        description: "Netflix",
        frequency: "monthly",
        startDate: "2025-01-01",
      })
    );
    const created = await json<{ id: number }>(createRes);

    const res = await PATCH(
      makeJson("PATCH", `/api/recurring/${created.id}`, { amount: 1299 }),
      ctx(created.id)
    );
    expect(res.status).toBe(200);
    const body = await json<{ amount: number }>(res);
    expect(body.amount).toBe(1299);
  });

  it("POST /generate creates pending transactions", async () => {
    await POST_REC(
      makeJson("POST", "/api/recurring", {
        amount: 999,
        description: "Daily coffee",
        frequency: "daily",
        startDate: "2025-01-01",
      })
    );
    const res = await GENERATE(
      makeJson("POST", "/api/recurring/generate", { upToDate: "2025-01-03" })
    );
    expect(res.status).toBe(200);
    const body = await json<{ created: number }>(res);
    expect(body.created).toBe(3);
  });

  it("DELETE removes a recurring template", async () => {
    const createRes = await POST_REC(
      makeJson("POST", "/api/recurring", {
        amount: 999,
        description: "Netflix",
        frequency: "monthly",
        startDate: "2025-01-01",
      })
    );
    const created = await json<{ id: number }>(createRes);

    const res = await DELETE(makeJson("DELETE", `/api/recurring/${created.id}`), ctx(created.id));
    expect(res.status).toBe(200);

    const getRes = await GET_BY_ID(makeGet(`/api/recurring/${created.id}`), ctx(created.id));
    expect(getRes.status).toBe(404);
  });
});
