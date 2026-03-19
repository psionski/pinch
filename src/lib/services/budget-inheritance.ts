import { eq, lte, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { budgets } from "@/lib/db/schema";

type Db = BetterSQLite3Database<typeof schema>;

/**
 * Returns the most recent month (≤ `month`) that has at least one budget row.
 * Returns null if no budgets exist anywhere.
 */
export function getEffectiveBudgetMonth(db: Db, month: string): string | null {
  const row = db
    .select({ month: budgets.month })
    .from(budgets)
    .where(lte(budgets.month, month))
    .orderBy(sql`${budgets.month} DESC`)
    .limit(1)
    .all();
  return row[0]?.month ?? null;
}

/**
 * Returns effective budgets for `month`, following inheritance.
 * Soft-deleted rows (deleted=1) are excluded from the returned map.
 *
 * Returns:
 * - `budgets`: Map<categoryId, amountCents> for active (non-deleted) budgets
 * - `inheritedFrom`: null if month has its own rows, otherwise the source month string
 */
export function getEffectiveBudgets(
  db: Db,
  month: string
): { budgets: Map<number, number>; inheritedFrom: string | null } {
  const sourceMonth = getEffectiveBudgetMonth(db, month);
  if (!sourceMonth) {
    return { budgets: new Map(), inheritedFrom: null };
  }

  const rows = db
    .select({ categoryId: budgets.categoryId, amount: budgets.amount, deleted: budgets.deleted })
    .from(budgets)
    .where(eq(budgets.month, sourceMonth))
    .all();

  const budgetMap = new Map<number, number>();
  for (const row of rows) {
    if (row.deleted === 0) {
      budgetMap.set(row.categoryId, row.amount);
    }
  }

  return {
    budgets: budgetMap,
    inheritedFrom: sourceMonth === month ? null : sourceMonth,
  };
}

/**
 * Returns true if `month` already has its own budget rows (including soft-deleted).
 * Used to decide whether copy-on-write materialization is needed before a mutation.
 */
export function monthHasOwnRows(db: Db, month: string): boolean {
  const row = db
    .select({ id: budgets.id })
    .from(budgets)
    .where(eq(budgets.month, month))
    .limit(1)
    .all();
  return row.length > 0;
}

/**
 * Copy all budget rows (including soft-deleted markers) from `sourceMonth` to `targetMonth`.
 * Only called when `targetMonth` has no own rows (ensured by the caller).
 */
export function materialize(db: Db, targetMonth: string, sourceMonth: string): void {
  const sourceRows = db
    .select({
      categoryId: budgets.categoryId,
      amount: budgets.amount,
      deleted: budgets.deleted,
    })
    .from(budgets)
    .where(eq(budgets.month, sourceMonth))
    .all();

  if (sourceRows.length === 0) return;

  db.transaction((tx) => {
    for (const row of sourceRows) {
      tx.insert(budgets)
        .values({
          categoryId: row.categoryId,
          month: targetMonth,
          amount: row.amount,
          deleted: row.deleted,
        })
        .run();
    }
  });
}

/**
 * Ensures `month` has its own rows (materializes from inheritance if needed).
 * Returns the source month used, or null if there was nothing to materialize.
 */
export function ensureOwnRows(db: Db, month: string): string | null {
  if (monthHasOwnRows(db, month)) return null;
  const sourceMonth = getEffectiveBudgetMonth(db, month);
  if (!sourceMonth || sourceMonth === month) return null;
  materialize(db, month, sourceMonth);
  return sourceMonth;
}
