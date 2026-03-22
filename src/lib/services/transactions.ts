import {
  and,
  eq,
  gte,
  lte,
  like,
  inArray,
  isNull,
  desc,
  asc,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { transactions, categories } from "@/lib/db/schema";
import type { Transaction } from "@/lib/db/schema";
import { buildChildrenMap, getDescendantIds } from "./category-hierarchy";
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
  CreateTransactionsBatchInput,
  UpdateTransactionsBatchInput,
  ListTransactionsInput,
  TransactionResponse,
} from "@/lib/validators/transactions";
import type { PaginatedResponse } from "@/lib/validators/common";
import { isoToday } from "@/lib/date-ranges";

type Db = BetterSQLite3Database<typeof schema>;

function parseTags(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return null;
  }
}

function parseTransaction(row: Transaction): TransactionResponse {
  return {
    ...row,
    type: row.type as "income" | "expense" | "transfer",
    tags: parseTags(row.tags),
  };
}

export class TransactionService {
  constructor(private db: Db) {}

  create(input: CreateTransactionInput): TransactionResponse {
    const [row] = this.db
      .insert(transactions)
      .values({
        amount: input.amount,
        type: input.type,
        description: input.description,
        merchant: input.merchant,
        categoryId: input.categoryId,
        date: input.date ?? isoToday(),
        receiptId: input.receiptId,
        recurringId: input.recurringId,
        notes: input.notes,
        tags: input.tags ? JSON.stringify(input.tags) : null,
      })
      .returning()
      .all();
    return parseTransaction(row);
  }

  createBatch(input: CreateTransactionsBatchInput): TransactionResponse[] {
    const values = input.transactions.map((tx) => ({
      amount: tx.amount,
      type: tx.type,
      description: tx.description,
      merchant: tx.merchant,
      categoryId: tx.categoryId,
      date: tx.date ?? isoToday(),
      receiptId: tx.receiptId ?? input.receiptId,
      recurringId: tx.recurringId,
      notes: tx.notes,
      tags: tx.tags ? JSON.stringify(tx.tags) : null,
    }));
    return this.db.insert(transactions).values(values).returning().all().map(parseTransaction);
  }

  getById(id: number): TransactionResponse | null {
    const [row] = this.db.select().from(transactions).where(eq(transactions.id, id)).all();
    return row ? parseTransaction(row) : null;
  }

  list(input: ListTransactionsInput): PaginatedResponse<TransactionResponse> {
    const filters: SQL[] = [];

    if (input.dateFrom !== undefined) filters.push(gte(transactions.date, input.dateFrom));
    if (input.dateTo !== undefined) filters.push(lte(transactions.date, input.dateTo));
    if (input.categoryId !== undefined) {
      if (input.categoryId === null) {
        filters.push(isNull(transactions.categoryId));
      } else {
        // Include the category itself and all descendants
        const descendantIds = this.getDescendantCategoryIds(input.categoryId);
        const allIds = [input.categoryId, ...descendantIds];
        filters.push(inArray(transactions.categoryId, allIds));
      }
    }
    if (input.amountMin !== undefined) filters.push(gte(transactions.amount, input.amountMin));
    if (input.amountMax !== undefined) filters.push(lte(transactions.amount, input.amountMax));
    if (input.merchant !== undefined)
      filters.push(like(transactions.merchant, `%${input.merchant}%`));
    if (input.type !== undefined) filters.push(eq(transactions.type, input.type));
    if (input.receiptId !== undefined) filters.push(eq(transactions.receiptId, input.receiptId));
    if (input.recurringId !== undefined)
      filters.push(eq(transactions.recurringId, input.recurringId));

    if (input.search !== undefined) {
      // Wrap in double quotes to force FTS5 phrase matching and neutralize special syntax
      const sanitized = `"${input.search.replace(/"/g, '""')}"`;
      filters.push(
        sql`${transactions.id} IN (SELECT rowid FROM transactions_fts WHERE transactions_fts MATCH ${sanitized})`
      );
    }

    if (input.tags !== undefined && input.tags.length > 0) {
      const tagConditions = input.tags.map(
        (tag) => sql`EXISTS (SELECT 1 FROM json_each(${transactions.tags}) WHERE value = ${tag})`
      );
      filters.push(or(...tagConditions)!);
    }

    const where = filters.length > 0 ? and(...filters) : undefined;

    const sortColumnMap = {
      date: transactions.date,
      amount: transactions.amount,
      merchant: transactions.merchant,
      createdAt: transactions.createdAt,
    } as const;
    const sortCol = sortColumnMap[input.sortBy];
    const orderBy = input.sortOrder === "asc" ? asc(sortCol) : desc(sortCol);

    const [{ total }] = this.db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(transactions)
      .where(where)
      .all();

    const data = this.db
      .select()
      .from(transactions)
      .where(where)
      .orderBy(orderBy)
      .limit(input.limit)
      .offset(input.offset)
      .all()
      .map(parseTransaction);

    return {
      data,
      total,
      limit: input.limit,
      offset: input.offset,
      hasMore: input.offset + data.length < total,
    };
  }

  update(id: number, input: UpdateTransactionInput): TransactionResponse | null {
    const rows = this.db
      .update(transactions)
      .set({
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.merchant !== undefined ? { merchant: input.merchant } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.date !== undefined ? { date: input.date } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.tags !== undefined
          ? { tags: input.tags !== null ? JSON.stringify(input.tags) : null }
          : {}),
        updatedAt: sql`(datetime('now'))`,
      })
      .where(eq(transactions.id, id))
      .returning()
      .all();

    return rows.length > 0 ? parseTransaction(rows[0]) : null;
  }

  updateBatch(input: UpdateTransactionsBatchInput): TransactionResponse[] {
    return this.db.transaction(() =>
      input.updates.flatMap(({ id, ...fields }) => {
        const result = this.update(id, fields);
        return result ? [result] : [];
      })
    );
  }

  delete(id: number): boolean {
    const result = this.db.delete(transactions).where(eq(transactions.id, id)).returning().all();
    return result.length > 0;
  }

  deleteBatch(ids: number[]): number {
    return this.db.delete(transactions).where(inArray(transactions.id, ids)).returning().all()
      .length;
  }

  /** Returns all descendant category IDs for a given category (children, grandchildren, etc). */
  private getDescendantCategoryIds(categoryId: number): number[] {
    const allCats = this.db
      .select({ id: categories.id, parentId: categories.parentId })
      .from(categories)
      .all();
    return getDescendantIds(categoryId, buildChildrenMap(allCats));
  }

  /** Returns all distinct tags across all transactions, sorted alphabetically. */
  listTags(): string[] {
    const rows = this.db.all<{ tag: string }>(
      sql`SELECT DISTINCT j.value AS tag
          FROM ${transactions}, json_each(${transactions.tags}) AS j
          WHERE ${transactions.tags} IS NOT NULL
          ORDER BY j.value`
    );
    return rows.map((r) => r.tag);
  }
}
