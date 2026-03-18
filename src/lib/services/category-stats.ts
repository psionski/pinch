/**
 * Shared utilities for category hierarchy traversal, spend rollup,
 * and per-category stats computation.
 *
 * Used by BudgetService and CategoryService to avoid duplicating logic.
 */

import { and, eq, gte, lte, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { budgets, categories, transactions } from "@/lib/db/schema";
import type { CategoryStats } from "@/lib/validators/categories";

type Db = BetterSQLite3Database<typeof schema>;

// ─── Hierarchy utilities ─────────────────────────────────────────────────────

interface CategoryNode {
  id: number;
  parentId: number | null;
}

/** Build a parent → children ID lookup from a flat list of categories. */
export function buildChildrenMap(categories: CategoryNode[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const cat of categories) {
    if (cat.parentId !== null) {
      const siblings = map.get(cat.parentId) ?? [];
      siblings.push(cat.id);
      map.set(cat.parentId, siblings);
    }
  }
  return map;
}

/**
 * Recursively sum a numeric value for a category and all its descendants.
 * `valueMap` maps category ID → own value (e.g. spend amount).
 */
export function rollupValue(
  id: number,
  childrenMap: Map<number, number[]>,
  valueMap: Map<number, number>
): number {
  let total = valueMap.get(id) ?? 0;
  const children = childrenMap.get(id);
  if (children) {
    for (const childId of children) {
      total += rollupValue(childId, childrenMap, valueMap);
    }
  }
  return total;
}

/**
 * Recursively sum multiple numeric fields for a category and all its descendants.
 * `valueMaps` is keyed by field name, each mapping category ID → own value.
 * Returns an object with the same keys, each holding the rolled-up total.
 */
export function rollupValues<K extends string>(
  id: number,
  childrenMap: Map<number, number[]>,
  valueMaps: Record<K, Map<number, number>>
): Record<K, number> {
  const keys = Object.keys(valueMaps) as K[];
  const result = {} as Record<K, number>;
  for (const key of keys) {
    result[key] = valueMaps[key].get(id) ?? 0;
  }
  const children = childrenMap.get(id);
  if (children) {
    for (const childId of children) {
      const childResult = rollupValues(childId, childrenMap, valueMaps);
      for (const key of keys) {
        result[key] += childResult[key];
      }
    }
  }
  return result;
}

// ─── Per-category stats for a month ──────────────────────────────────────────

/**
 * Returns per-category stats for the given month (YYYY-MM).
 * Includes total expense spend, rollup spend (with descendants),
 * transaction counts, budget amount, and category name.
 */
export function getCategoryStatsForMonth(db: Db, month: string): CategoryStats[] {
  const monthStart = `${month}-01`;
  const nextMonth = (() => {
    const [y, m] = month.split("-").map(Number);
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    return `${next}-01`;
  })();

  // Aggregate expense transactions per category for the month
  const spendRows = db
    .select({
      categoryId: transactions.categoryId,
      totalSpend: sql<number>`coalesce(sum(${transactions.amount}), 0)`.mapWith(Number),
      transactionCount: sql<number>`count(*)`.mapWith(Number),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.type, "expense"),
        gte(transactions.date, monthStart),
        lte(transactions.date, sql`date(${nextMonth}, '-1 day')`),
        sql`${transactions.categoryId} IS NOT NULL`
      )
    )
    .groupBy(transactions.categoryId)
    .all();

  // Get budgets for the month
  const budgetRows = db
    .select({
      categoryId: budgets.categoryId,
      amount: budgets.amount,
    })
    .from(budgets)
    .where(eq(budgets.month, month))
    .all();

  const budgetMap = new Map<number, number>();
  for (const b of budgetRows) {
    budgetMap.set(b.categoryId, b.amount);
  }

  // Get all categories with hierarchy info
  const allCategories = db
    .select({
      id: categories.id,
      name: categories.name,
      parentId: categories.parentId,
    })
    .from(categories)
    .all();

  const spendAmountMap = new Map<number, number>();
  const spendCountMap = new Map<number, number>();
  for (const row of spendRows) {
    if (row.categoryId !== null) {
      spendAmountMap.set(row.categoryId, row.totalSpend);
      spendCountMap.set(row.categoryId, row.transactionCount);
    }
  }

  const childrenMap = buildChildrenMap(allCategories);

  return allCategories.map((cat) => {
    const rollup = rollupValues(cat.id, childrenMap, {
      spend: spendAmountMap,
      count: spendCountMap,
    });
    return {
      categoryId: cat.id,
      categoryName: cat.name,
      totalSpend: spendAmountMap.get(cat.id) ?? 0,
      transactionCount: spendCountMap.get(cat.id) ?? 0,
      rollupSpend: rollup.spend,
      rollupTransactionCount: rollup.count,
      budgetAmount: budgetMap.get(cat.id) ?? null,
    };
  });
}
