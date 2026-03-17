import { describe, it, expect, beforeEach } from "vitest";
import { setupTestServices, makeGet, makeJson, json } from "./helpers";

setupTestServices();

describe("Report API Routes", () => {
  let GET_SUMMARY: (req: Request) => Promise<Response>;
  let GET_BREAKDOWN: (req: Request) => Promise<Response>;
  let GET_TRENDS: (req: Request) => Promise<Response>;
  let GET_TOP_MERCHANTS: (req: Request) => Promise<Response>;
  let POST_TX: (req: Request) => Promise<Response>;
  let POST_CAT: (req: Request) => Promise<Response>;

  beforeEach(async () => {
    const summary = await import("@/app/api/reports/summary/route");
    const breakdown = await import("@/app/api/reports/breakdown/route");
    const trends = await import("@/app/api/reports/trends/route");
    const topMerchants = await import("@/app/api/reports/top-merchants/route");
    const txs = await import("@/app/api/transactions/route");
    const cats = await import("@/app/api/categories/route");
    GET_SUMMARY = summary.GET;
    GET_BREAKDOWN = breakdown.GET;
    GET_TRENDS = trends.GET;
    GET_TOP_MERCHANTS = topMerchants.GET;
    POST_TX = txs.POST;
    POST_CAT = cats.POST;
  });

  async function seedData(): Promise<void> {
    const cat = await json<{ id: number }>(
      await POST_CAT(makeJson("POST", "/api/categories", { name: "Food" }))
    );
    await POST_TX(
      makeJson("POST", "/api/transactions", {
        amount: 2000,
        description: "Lunch",
        date: "2025-01-15",
        categoryId: cat.id,
        merchant: "CafeX",
      })
    );
    await POST_TX(
      makeJson("POST", "/api/transactions", {
        amount: 3000,
        description: "Dinner",
        date: "2025-01-20",
        categoryId: cat.id,
        merchant: "RestaurantY",
      })
    );
  }

  it("GET /summary returns spending summary", async () => {
    await seedData();
    const res = await GET_SUMMARY(
      makeGet("/api/reports/summary", {
        dateFrom: "2025-01-01",
        dateTo: "2025-01-31",
        groupBy: "category",
      })
    );
    expect(res.status).toBe(200);
    const body = await json<{ period: { total: number }; groups: unknown[] }>(res);
    expect(body.period.total).toBe(5000);
    expect(body.groups).toHaveLength(1);
  });

  it("GET /breakdown returns category breakdown", async () => {
    await seedData();
    const res = await GET_BREAKDOWN(
      makeGet("/api/reports/breakdown", { dateFrom: "2025-01-01", dateTo: "2025-01-31" })
    );
    expect(res.status).toBe(200);
    const body = await json<Array<{ percentage: number }>>(res);
    expect(body).toHaveLength(1);
    expect(body[0].percentage).toBe(100);
  });

  it("GET /trends returns trend data", async () => {
    await seedData();
    const res = await GET_TRENDS(makeGet("/api/reports/trends", { months: "3" }));
    expect(res.status).toBe(200);
    const body = await json<Array<{ month: string; total: number }>>(res);
    expect(body.length).toBeGreaterThanOrEqual(1);
  });

  it("GET /top-merchants returns top merchants", async () => {
    await seedData();
    const res = await GET_TOP_MERCHANTS(
      makeGet("/api/reports/top-merchants", { dateFrom: "2025-01-01", dateTo: "2025-01-31" })
    );
    expect(res.status).toBe(200);
    const body = await json<Array<{ merchant: string; total: number }>>(res);
    expect(body).toHaveLength(2);
  });

  it("GET /summary returns 400 on missing params", async () => {
    const res = await GET_SUMMARY(makeGet("/api/reports/summary"));
    expect(res.status).toBe(400);
  });
});
