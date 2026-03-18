import { and, eq, gte, lte, like, sql, type SQL } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { categories, transactions, budgets } from "@/lib/db/schema";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  RecategorizeInput,
  MergeCategoriesInput,
  CategoryResponse,
  CategoryWithCountResponse,
  CategoryStats,
} from "@/lib/validators/categories";

type Db = BetterSQLite3Database<typeof schema>;

export class CategoryService {
  constructor(private db: Db) {}

  create(input: CreateCategoryInput): CategoryResponse {
    const [row] = this.db
      .insert(categories)
      .values({
        name: input.name,
        parentId: input.parentId ?? null,
        icon: input.icon,
        color: input.color,
      })
      .returning()
      .all();
    return row;
  }

  /** Returns all categories with transaction counts. Parent/child hierarchy is represented via `parentId`. */
  getAll(): CategoryWithCountResponse[] {
    const allCategories = this.db.select().from(categories).all();

    const counts = this.db
      .select({
        categoryId: transactions.categoryId,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(transactions)
      .groupBy(transactions.categoryId)
      .all();

    const countMap = new Map<number, number>();
    for (const { categoryId, count } of counts) {
      if (categoryId !== null) countMap.set(categoryId, count);
    }

    return allCategories.map((cat) => ({
      ...cat,
      transactionCount: countMap.get(cat.id) ?? 0,
    }));
  }

  getById(id: number): CategoryResponse | null {
    const [row] = this.db.select().from(categories).where(eq(categories.id, id)).all();
    return row ?? null;
  }

  update(id: number, input: UpdateCategoryInput): CategoryResponse | null {
    const rows = this.db
      .update(categories)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        updatedAt: sql`(datetime('now'))`,
      })
      .where(eq(categories.id, id))
      .returning()
      .all();

    return rows.length > 0 ? rows[0] : null;
  }

  delete(id: number): boolean {
    const result = this.db.delete(categories).where(eq(categories.id, id)).returning().all();
    return result.length > 0;
  }

  /**
   * Returns per-category stats for the given month (YYYY-MM).
   * Includes total expense spend, transaction count, and budget amount.
   */
  getStats(month: string): CategoryStats[] {
    const monthStart = `${month}-01`;
    const nextMonth = (() => {
      const [y, m] = month.split("-").map(Number);
      const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
      return `${next}-01`;
    })();

    // Aggregate expense transactions per category for the month
    const spendRows = this.db
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
    const budgetRows = this.db
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

    // Get all category IDs to include categories with zero spend
    const allCategories = this.db.select({ id: categories.id }).from(categories).all();

    const spendMap = new Map<number, { totalSpend: number; transactionCount: number }>();
    for (const row of spendRows) {
      if (row.categoryId !== null) {
        spendMap.set(row.categoryId, {
          totalSpend: row.totalSpend,
          transactionCount: row.transactionCount,
        });
      }
    }

    return allCategories.map((cat) => ({
      categoryId: cat.id,
      totalSpend: spendMap.get(cat.id)?.totalSpend ?? 0,
      transactionCount: spendMap.get(cat.id)?.transactionCount ?? 0,
      budgetAmount: budgetMap.get(cat.id) ?? null,
    }));
  }

  /**
   * Bulk-move transactions matching the given filters to a new category.
   * Returns the number of transactions updated.
   */
  recategorize(input: RecategorizeInput): number {
    const filters: SQL[] = [];

    if (input.sourceCategoryId !== undefined) {
      filters.push(eq(transactions.categoryId, input.sourceCategoryId));
    }
    if (input.merchantPattern !== undefined) {
      filters.push(like(transactions.merchant, `%${input.merchantPattern}%`));
    }
    if (input.descriptionPattern !== undefined) {
      filters.push(like(transactions.description, `%${input.descriptionPattern}%`));
    }
    if (input.dateFrom !== undefined) {
      filters.push(gte(transactions.date, input.dateFrom));
    }
    if (input.dateTo !== undefined) {
      filters.push(lte(transactions.date, input.dateTo));
    }

    const where = filters.length > 0 ? and(...filters) : undefined;

    return this.db
      .update(transactions)
      .set({
        categoryId: input.targetCategoryId,
        updatedAt: sql`(datetime('now'))`,
      })
      .where(where)
      .returning()
      .all().length;
  }

  /**
   * Merge source category into target:
   * - All transactions reassigned to target
   * - Non-conflicting budgets transferred to target (conflicting ones are dropped)
   * - Source category deleted (cascade-deletes remaining budgets)
   */
  merge(input: MergeCategoriesInput): void {
    const { sourceCategoryId, targetCategoryId } = input;

    this.db.transaction((tx) => {
      // Move all transactions to target
      tx.update(transactions)
        .set({
          categoryId: targetCategoryId,
          updatedAt: sql`(datetime('now'))`,
        })
        .where(eq(transactions.categoryId, sourceCategoryId))
        .run();

      // Transfer budgets that don't conflict with an existing target budget for the same month
      tx.update(budgets)
        .set({ categoryId: targetCategoryId })
        .where(
          and(
            eq(budgets.categoryId, sourceCategoryId),
            sql`${budgets.month} NOT IN (SELECT month FROM budgets WHERE category_id = ${targetCategoryId})`
          )
        )
        .run();

      // Delete source category — cascade-deletes any remaining source budgets
      tx.delete(categories).where(eq(categories.id, sourceCategoryId)).run();
    });
  }
}
