import { and, eq, gte, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { budgets } from "@/lib/db/schema";
import type {
  SetBudgetInput,
  GetBudgetStatusInput,
  CopyBudgetsInput,
  BudgetResponse,
} from "@/lib/validators/budgets";
import type { BudgetStatusItem } from "@/lib/validators/reports";
import type { ReportService } from "./reports";

type Db = BetterSQLite3Database<typeof schema>;

export class BudgetService {
  constructor(
    private db: Db,
    private reportService: ReportService
  ) {}

  /**
   * Upsert a budget for a category + month.
   * When `applyToFutureMonths` is true, also upserts the same amount for every
   * existing budget row of the same category that is in a later month.
   */
  set(input: SetBudgetInput): BudgetResponse {
    const existing = this.db
      .select()
      .from(budgets)
      .where(and(eq(budgets.categoryId, input.categoryId), eq(budgets.month, input.month)))
      .all();

    let result: BudgetResponse;
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
   * enriched with actual spend from transactions (including child category rollup).
   */
  getForMonth(input: GetBudgetStatusInput): BudgetStatusItem[] {
    const stats = this.reportService.getBudgetStats({
      month: input.month,
      type: "expense",
      includeZeroSpend: true,
      includeUncategorized: false,
    });

    return stats
      .filter((s) => s.budgetAmount !== null)
      .map((s) => {
        const budgetAmount = s.budgetAmount!;
        const spentAmount = s.rollupTotal;
        const remaining = budgetAmount - spentAmount;
        const percentUsed =
          budgetAmount > 0
            ? Math.round((spentAmount / budgetAmount) * 10000) / 100
            : spentAmount > 0
              ? Infinity
              : 0;
        return {
          categoryId: s.categoryId!,
          categoryName: s.categoryName!,
          budgetAmount,
          spentAmount,
          remainingAmount: remaining,
          percentUsed,
          isOver: spentAmount > budgetAmount,
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
  listForCategory(categoryId: number): BudgetResponse[] {
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
