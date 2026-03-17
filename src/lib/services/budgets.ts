import { and, eq, gte, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { budgets, categories } from "@/lib/db/schema";
import type {
  SetBudgetInput,
  GetBudgetStatusInput,
  CopyBudgetsInput,
} from "@/lib/validators/budgets";
import type { BudgetStatusItem } from "@/lib/validators/reports";
import type { Budget } from "@/lib/db/schema";

type Db = BetterSQLite3Database<typeof schema>;

export class BudgetService {
  constructor(private db: Db) {}

  /**
   * Upsert a budget for a category + month.
   * When `applyToFutureMonths` is true, also upserts the same amount for every
   * existing budget row of the same category that is in a later month.
   */
  set(input: SetBudgetInput): Budget {
    const existing = this.db
      .select()
      .from(budgets)
      .where(and(eq(budgets.categoryId, input.categoryId), eq(budgets.month, input.month)))
      .all();

    let result: Budget;
    if (existing.length > 0) {
      const [row] = this.db
        .update(budgets)
        .set({ amount: input.amount })
        .where(and(eq(budgets.categoryId, input.categoryId), eq(budgets.month, input.month)))
        .returning()
        .all();
      result = row;
    } else {
      const [row] = this.db
        .insert(budgets)
        .values({ categoryId: input.categoryId, month: input.month, amount: input.amount })
        .returning()
        .all();
      result = row;
    }

    if (input.applyToFutureMonths) {
      this.db
        .update(budgets)
        .set({ amount: input.amount })
        .where(
          and(
            eq(budgets.categoryId, input.categoryId),
            gte(budgets.month, input.month),
            sql`${budgets.month} != ${input.month}`
          )
        )
        .run();
    }

    return result;
  }

  /**
   * Returns budget status for every category that has a budget in the given month,
   * enriched with actual spend from transactions.
   */
  getForMonth(input: GetBudgetStatusInput): BudgetStatusItem[] {
    const monthFrom = `${input.month}-01`;
    // Compute last day of the month in JS (avoids a standalone SQL select)
    const [year, month] = input.month.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)); // day 0 of next month = last day of this month
    const monthTo = `${lastDay.getUTCFullYear()}-${String(lastDay.getUTCMonth() + 1).padStart(2, "0")}-${String(lastDay.getUTCDate()).padStart(2, "0")}`;

    const rows = this.db
      .select({
        categoryId: budgets.categoryId,
        categoryName: categories.name,
        budgetAmount: budgets.amount,
        spentAmount: sql<number>`coalesce((
            SELECT sum(t.amount)
            FROM transactions t
            WHERE t.category_id = ${budgets.categoryId}
              AND t.type = 'expense'
              AND t.date >= ${monthFrom}
              AND t.date <= ${monthTo}
          ), 0)`.mapWith(Number),
      })
      .from(budgets)
      .innerJoin(categories, eq(budgets.categoryId, categories.id))
      .where(eq(budgets.month, input.month))
      .orderBy(categories.name)
      .all();

    return rows.map((r) => {
      const remaining = r.budgetAmount - r.spentAmount;
      const percentUsed =
        r.budgetAmount > 0
          ? Math.round((r.spentAmount / r.budgetAmount) * 10000) / 100
          : r.spentAmount > 0
            ? Infinity
            : 0;
      return {
        categoryId: r.categoryId,
        categoryName: r.categoryName,
        budgetAmount: r.budgetAmount,
        spentAmount: r.spentAmount,
        remainingAmount: remaining,
        percentUsed,
        isOver: r.spentAmount > r.budgetAmount,
      };
    });
  }

  /**
   * Copy all budgets from `fromMonth` into `toMonth`.
   * Already-existing budgets for `toMonth` are updated (upserted).
   * Returns the number of rows written.
   */
  copyFromPreviousMonth(input: CopyBudgetsInput): number {
    const source = this.db.select().from(budgets).where(eq(budgets.month, input.fromMonth)).all();

    if (source.length === 0) return 0;

    let count = 0;
    this.db.transaction((tx) => {
      for (const row of source) {
        const existing = tx
          .select({ id: budgets.id })
          .from(budgets)
          .where(and(eq(budgets.categoryId, row.categoryId), eq(budgets.month, input.toMonth)))
          .all();

        if (existing.length > 0) {
          tx.update(budgets)
            .set({ amount: row.amount })
            .where(and(eq(budgets.categoryId, row.categoryId), eq(budgets.month, input.toMonth)))
            .run();
        } else {
          tx.insert(budgets)
            .values({ categoryId: row.categoryId, month: input.toMonth, amount: row.amount })
            .run();
        }
        count++;
      }
    });

    return count;
  }

  /** Returns all budget rows for a given category, sorted by month. */
  listForCategory(categoryId: number): Budget[] {
    return this.db
      .select()
      .from(budgets)
      .where(eq(budgets.categoryId, categoryId))
      .orderBy(budgets.month)
      .all();
  }

  delete(categoryId: number, month: string): boolean {
    const result = this.db
      .delete(budgets)
      .where(and(eq(budgets.categoryId, categoryId), eq(budgets.month, month)))
      .returning()
      .all();
    return result.length > 0;
  }
}
