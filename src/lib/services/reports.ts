import { and, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { transactions, categories } from "@/lib/db/schema";
import type {
  SpendingSummaryInput,
  CategoryBreakdownInput,
  TrendsInput,
  TopMerchantsInput,
  SpendingGroup,
  CategoryBreakdownItem,
  TrendPoint,
  TopMerchant,
  SpendingSummaryResult,
} from "@/lib/validators/reports";

type Db = BetterSQLite3Database<typeof schema>;

function dateFilters(dateFrom: string, dateTo: string): SQL[] {
  return [gte(transactions.date, dateFrom), lte(transactions.date, dateTo)];
}

function typeFilter(type: "income" | "expense" | "all"): SQL | undefined {
  if (type === "all") return undefined;
  return eq(transactions.type, type);
}

function periodTotal(db: Db, dateFrom: string, dateTo: string, type: "income" | "expense" | "all") {
  const filters: SQL[] = [...dateFilters(dateFrom, dateTo)];
  const tf = typeFilter(type);
  if (tf) filters.push(tf);

  const [row] = db
    .select({
      total: sql<number>`coalesce(sum(${transactions.amount}), 0)`.mapWith(Number),
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(transactions)
    .where(and(...filters))
    .all();
  return row ?? { total: 0, count: 0 };
}

export class ReportService {
  constructor(private db: Db) {}

  spendingSummary(input: SpendingSummaryInput): SpendingSummaryResult {
    const { dateFrom, dateTo, groupBy, type } = input;
    const filters: SQL[] = [...dateFilters(dateFrom, dateTo)];
    const tf = typeFilter(type);
    if (tf) filters.push(tf);
    const where = and(...filters);

    const period = periodTotal(this.db, dateFrom, dateTo, type);

    let comparePeriod:
      | { dateFrom: string; dateTo: string; total: number; count: number }
      | undefined;
    if (input.compareDateFrom && input.compareDateTo) {
      const ct = periodTotal(this.db, input.compareDateFrom, input.compareDateTo, type);
      comparePeriod = { dateFrom: input.compareDateFrom, dateTo: input.compareDateTo, ...ct };
    }

    let groups: SpendingGroup[];

    if (groupBy === "category") {
      const rows = this.db
        .select({
          categoryId: transactions.categoryId,
          categoryName: categories.name,
          total: sql<number>`coalesce(sum(${transactions.amount}), 0)`.mapWith(Number),
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(transactions)
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .where(where)
        .groupBy(transactions.categoryId)
        .orderBy(sql`sum(${transactions.amount}) DESC`)
        .all();

      const compareMap = new Map<number | null, number>();
      if (input.compareDateFrom && input.compareDateTo) {
        const cFilters: SQL[] = [...dateFilters(input.compareDateFrom, input.compareDateTo)];
        if (tf) cFilters.push(tf);
        const cRows = this.db
          .select({
            categoryId: transactions.categoryId,
            total: sql<number>`coalesce(sum(${transactions.amount}), 0)`.mapWith(Number),
          })
          .from(transactions)
          .where(and(...cFilters))
          .groupBy(transactions.categoryId)
          .all();
        for (const r of cRows) compareMap.set(r.categoryId, r.total);
      }

      groups = rows.map((r) => ({
        key: r.categoryName ?? "(uncategorized)",
        categoryId: r.categoryId,
        total: r.total,
        count: r.count,
        ...(input.compareDateFrom ? { compareTotal: compareMap.get(r.categoryId) ?? 0 } : {}),
      }));
    } else if (groupBy === "month") {
      const rows = this.db
        .select({
          month: sql<string>`strftime('%Y-%m', ${transactions.date})`.mapWith(String),
          total: sql<number>`coalesce(sum(${transactions.amount}), 0)`.mapWith(Number),
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(transactions)
        .where(where)
        .groupBy(sql`strftime('%Y-%m', ${transactions.date})`)
        .orderBy(sql`strftime('%Y-%m', ${transactions.date}) ASC`)
        .all();

      const compareMap = new Map<string, number>();
      if (input.compareDateFrom && input.compareDateTo) {
        const cFilters: SQL[] = [...dateFilters(input.compareDateFrom, input.compareDateTo)];
        if (tf) cFilters.push(tf);
        const cRows = this.db
          .select({
            month: sql<string>`strftime('%Y-%m', ${transactions.date})`.mapWith(String),
            total: sql<number>`coalesce(sum(${transactions.amount}), 0)`.mapWith(Number),
          })
          .from(transactions)
          .where(and(...cFilters))
          .groupBy(sql`strftime('%Y-%m', ${transactions.date})`)
          .all();
        for (const r of cRows) compareMap.set(r.month, r.total);
      }

      groups = rows.map((r) => ({
        key: r.month,
        total: r.total,
        count: r.count,
        ...(input.compareDateFrom ? { compareTotal: compareMap.get(r.month) ?? 0 } : {}),
      }));
    } else {
      // groupBy === 'merchant'
      const rows = this.db
        .select({
          merchant: sql<string>`coalesce(${transactions.merchant}, '(no merchant)')`.mapWith(
            String
          ),
          total: sql<number>`coalesce(sum(${transactions.amount}), 0)`.mapWith(Number),
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(transactions)
        .where(where)
        .groupBy(transactions.merchant)
        .orderBy(sql`sum(${transactions.amount}) DESC`)
        .all();

      const compareMap = new Map<string, number>();
      if (input.compareDateFrom && input.compareDateTo) {
        const cFilters: SQL[] = [...dateFilters(input.compareDateFrom, input.compareDateTo)];
        if (tf) cFilters.push(tf);
        const cRows = this.db
          .select({
            merchant: sql<string>`coalesce(${transactions.merchant}, '(no merchant)')`.mapWith(
              String
            ),
            total: sql<number>`coalesce(sum(${transactions.amount}), 0)`.mapWith(Number),
          })
          .from(transactions)
          .where(and(...cFilters))
          .groupBy(transactions.merchant)
          .all();
        for (const r of cRows) compareMap.set(r.merchant, r.total);
      }

      groups = rows.map((r) => ({
        key: r.merchant,
        total: r.total,
        count: r.count,
        ...(input.compareDateFrom ? { compareTotal: compareMap.get(r.merchant) ?? 0 } : {}),
      }));
    }

    return {
      period: { dateFrom, dateTo, ...period },
      comparePeriod,
      groups,
    };
  }

  categoryBreakdown(input: CategoryBreakdownInput): CategoryBreakdownItem[] {
    const filters: SQL[] = [...dateFilters(input.dateFrom, input.dateTo)];
    const tf = typeFilter(input.type);
    if (tf) filters.push(tf);

    const rows = this.db
      .select({
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        total: sql<number>`coalesce(sum(${transactions.amount}), 0)`.mapWith(Number),
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(...filters))
      .groupBy(transactions.categoryId)
      .orderBy(sql`sum(${transactions.amount}) DESC`)
      .all();

    const grandTotal = rows.reduce((s, r) => s + r.total, 0);

    return rows.map((r) => ({
      categoryId: r.categoryId,
      categoryName: r.categoryName ?? null,
      total: r.total,
      count: r.count,
      percentage: grandTotal > 0 ? Math.round((r.total / grandTotal) * 10000) / 100 : 0,
    }));
  }

  trends(input: TrendsInput): TrendPoint[] {
    const tf = typeFilter(input.type);

    // Build month series for the last N months using a recursive CTE
    const rows = this.db.all<{ month: string; total: number; count: number }>(
      sql`
        WITH RECURSIVE months(m) AS (
          SELECT strftime('%Y-%m', 'now', '-' || (${input.months} - 1) || ' months')
          UNION ALL
          SELECT strftime('%Y-%m', m || '-01', '+1 month')
          FROM months
          WHERE m < strftime('%Y-%m', 'now')
        )
        SELECT
          months.m AS month,
          coalesce(sum(t.amount), 0) AS total,
          coalesce(count(t.id), 0) AS count
        FROM months
        LEFT JOIN transactions t
          ON strftime('%Y-%m', t.date) = months.m
          ${input.categoryId !== undefined ? sql`AND t.category_id = ${input.categoryId}` : sql``}
          ${tf ? sql`AND t.type = ${input.type}` : sql``}
        GROUP BY months.m
        ORDER BY months.m ASC
      `
    );

    return rows.map((r) => ({
      month: r.month,
      total: Number(r.total),
      count: Number(r.count),
    }));
  }

  topMerchants(input: TopMerchantsInput): TopMerchant[] {
    const filters: SQL[] = [...dateFilters(input.dateFrom, input.dateTo)];
    const tf = typeFilter(input.type);
    if (tf) filters.push(tf);
    // Only include transactions that have a merchant
    filters.push(sql`${transactions.merchant} IS NOT NULL`);

    const rows = this.db
      .select({
        merchant: transactions.merchant,
        total: sql<number>`coalesce(sum(${transactions.amount}), 0)`.mapWith(Number),
        count: sql<number>`count(*)`.mapWith(Number),
        avgAmount: sql<number>`coalesce(avg(${transactions.amount}), 0)`.mapWith(Number),
      })
      .from(transactions)
      .where(and(...filters))
      .groupBy(transactions.merchant)
      .orderBy(sql`sum(${transactions.amount}) DESC`)
      .limit(input.limit)
      .all();

    return rows.map((r) => ({
      merchant: r.merchant!,
      total: r.total,
      count: r.count,
      avgAmount: Math.round(r.avgAmount),
    }));
  }
}
