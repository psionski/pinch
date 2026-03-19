import { eq, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { recurringTransactions, transactions } from "@/lib/db/schema";
import type { RecurringTransaction } from "@/lib/db/schema";
import type {
  CreateRecurringInput,
  UpdateRecurringInput,
  RecurringResponse,
} from "@/lib/validators/recurring";

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

// ─── Date math helpers ────────────────────────────────────────────────────────

/**
 * Parse a YYYY-MM-DD string into a Date object (UTC midnight).
 * Using explicit UTC construction avoids timezone shifting.
 */
function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Compute the next occurrence of a recurring template after `afterDate`.
 * Returns null if the template is inactive, has ended, or has no future occurrences.
 */
export function computeNextOccurrence(r: RecurringTransaction, afterDate: Date): string | null {
  if (!r.isActive) return null;
  if (r.endDate && parseDate(r.endDate) <= afterDate) return null;

  const startDate = parseDate(r.startDate);
  // The "cursor" is one day after afterDate
  const cursor = new Date(afterDate);
  cursor.setUTCDate(cursor.getUTCDate() + 1);

  let candidate: Date;

  switch (r.frequency) {
    case "daily": {
      // The next occurrence is simply cursor, as long as it's >= startDate
      candidate = cursor < startDate ? new Date(startDate) : new Date(cursor);
      break;
    }
    case "weekly": {
      const targetDay = r.dayOfWeek ?? startDate.getUTCDay();
      candidate = cursor < startDate ? new Date(startDate) : new Date(cursor);
      // Advance to the correct day of week
      const diff = (targetDay - candidate.getUTCDay() + 7) % 7;
      candidate.setUTCDate(candidate.getUTCDate() + diff);
      break;
    }
    case "monthly": {
      const targetDay = r.dayOfMonth ?? startDate.getUTCDate();
      // Start from the cursor's year/month and try to land on targetDay
      candidate = cursor < startDate ? new Date(startDate) : new Date(cursor);
      // Set to the desired day in the current month
      candidate.setUTCDate(1); // avoid overflow when adjusting months
      if (cursor < startDate) {
        candidate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
      } else {
        candidate = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1));
      }
      candidate.setUTCDate(targetDay);
      // If that date is in the past or before startDate, advance one month
      if (candidate < (cursor < startDate ? startDate : cursor)) {
        candidate.setUTCMonth(candidate.getUTCMonth() + 1);
        candidate.setUTCDate(1);
        candidate.setUTCDate(targetDay);
      }
      break;
    }
    case "yearly": {
      const targetMonth = startDate.getUTCMonth();
      const targetDay = startDate.getUTCDate();
      const base = cursor < startDate ? startDate : cursor;
      candidate = new Date(Date.UTC(base.getUTCFullYear(), targetMonth, targetDay));
      if (candidate < base) {
        candidate = new Date(Date.UTC(base.getUTCFullYear() + 1, targetMonth, targetDay));
      }
      break;
    }
    default:
      return null;
  }

  if (r.endDate && candidate > parseDate(r.endDate)) return null;
  return formatDate(candidate);
}

/**
 * Enumerate all occurrence dates for a recurring template between `fromDate` (exclusive)
 * and `upToDate` (inclusive).
 */
function occurrencesBetween(r: RecurringTransaction, fromDate: Date, upToDate: Date): string[] {
  const results: string[] = [];
  let cursor = new Date(fromDate);

  while (true) {
    const next = computeNextOccurrence(r, cursor);
    if (!next) break;
    const nextDate = parseDate(next);
    if (nextDate > upToDate) break;
    results.push(next);
    cursor = nextDate;
  }

  return results;
}

function parseRecurring(row: RecurringTransaction, afterDate: Date): RecurringResponse {
  return {
    ...row,
    type: row.type as "income" | "expense",
    frequency: row.frequency as "daily" | "weekly" | "monthly" | "yearly",
    tags: parseTags(row.tags),
    nextOccurrence: computeNextOccurrence(row, afterDate),
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class RecurringService {
  constructor(private db: Db) {}

  create(input: CreateRecurringInput): RecurringResponse {
    const [row] = this.db
      .insert(recurringTransactions)
      .values({
        amount: input.amount,
        type: input.type,
        description: input.description,
        merchant: input.merchant,
        categoryId: input.categoryId,
        frequency: input.frequency,
        dayOfMonth: input.dayOfMonth ?? null,
        dayOfWeek: input.dayOfWeek ?? null,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        notes: input.notes,
        tags: input.tags ? JSON.stringify(input.tags) : null,
      })
      .returning()
      .all();
    return parseRecurring(row, new Date());
  }

  list(): RecurringResponse[] {
    const now = new Date();
    return this.db
      .select()
      .from(recurringTransactions)
      .orderBy(recurringTransactions.description)
      .all()
      .map((r) => parseRecurring(r, now));
  }

  getById(id: number): RecurringResponse | null {
    const [row] = this.db
      .select()
      .from(recurringTransactions)
      .where(eq(recurringTransactions.id, id))
      .all();
    return row ? parseRecurring(row, new Date()) : null;
  }

  update(id: number, input: UpdateRecurringInput): RecurringResponse | null {
    const rows = this.db
      .update(recurringTransactions)
      .set({
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.merchant !== undefined ? { merchant: input.merchant } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.frequency !== undefined ? { frequency: input.frequency } : {}),
        ...(input.dayOfMonth !== undefined ? { dayOfMonth: input.dayOfMonth } : {}),
        ...(input.dayOfWeek !== undefined ? { dayOfWeek: input.dayOfWeek } : {}),
        ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
        ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive ? 1 : 0 } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.tags !== undefined
          ? { tags: input.tags !== null ? JSON.stringify(input.tags) : null }
          : {}),
        updatedAt: sql`(datetime('now'))`,
      })
      .where(eq(recurringTransactions.id, id))
      .returning()
      .all();

    return rows.length > 0 ? parseRecurring(rows[0], new Date()) : null;
  }

  delete(id: number): boolean {
    const result = this.db
      .delete(recurringTransactions)
      .where(eq(recurringTransactions.id, id))
      .returning()
      .all();
    return result.length > 0;
  }

  /**
   * Generate all pending transactions for active recurring templates up to today.
   * For each template, creates transactions for dates after `lastGenerated` (or `startDate`)
   * up to and including today.
   * Returns the total number of transactions created.
   */
  generatePending(upTo?: Date): number {
    const upToDate = upTo ?? new Date();
    const active = this.db
      .select()
      .from(recurringTransactions)
      .where(eq(recurringTransactions.isActive, 1))
      .all();

    let created = 0;

    this.db.transaction((tx) => {
      for (const r of active) {
        // Start generating from the day after lastGenerated, or from startDate - 1 day
        const fromStr = r.lastGenerated ?? null;
        const fromDate = fromStr
          ? parseDate(fromStr)
          : (() => {
              const d = parseDate(r.startDate);
              d.setUTCDate(d.getUTCDate() - 1);
              return d;
            })();

        if (r.endDate && parseDate(r.endDate) < fromDate) continue;

        const dates = occurrencesBetween(r, fromDate, upToDate);
        if (dates.length === 0) continue;

        tx.insert(transactions)
          .values(
            dates.map((date) => ({
              amount: r.amount,
              type: r.type,
              description: r.description,
              merchant: r.merchant,
              categoryId: r.categoryId,
              date,
              recurringId: r.id,
              notes: r.notes,
              tags: r.tags,
            }))
          )
          .run();

        // Update lastGenerated to the last date we created
        tx.update(recurringTransactions)
          .set({
            lastGenerated: dates[dates.length - 1],
            updatedAt: sql`(datetime('now'))`,
          })
          .where(eq(recurringTransactions.id, r.id))
          .run();

        created += dates.length;
      }
    });

    return created;
  }
}
