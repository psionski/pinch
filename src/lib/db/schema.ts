import {
  integer,
  sqliteTable,
  text,
  index,
  uniqueIndex,
  check,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── Categories ──────────────────────────────────────────────────────────────

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  parentId: integer("parent_id").references((): AnySQLiteColumn => categories.id, {
    onDelete: "set null",
  }),
  icon: text("icon"),
  color: text("color"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Receipts ─────────────────────────────────────────────────────────────────

export const receipts = sqliteTable("receipts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  merchant: text("merchant"),
  date: text("date").notNull(),
  total: integer("total"), // cents
  imagePath: text("image_path"),
  rawText: text("raw_text"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ─── Recurring Transactions ───────────────────────────────────────────────────

export const recurringTransactions = sqliteTable(
  "recurring_transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    amount: integer("amount").notNull(), // cents
    type: text("type").notNull().default("expense"),
    description: text("description").notNull(),
    merchant: text("merchant"),
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    frequency: text("frequency").notNull(), // 'daily' | 'weekly' | 'monthly' | 'yearly'
    dayOfMonth: integer("day_of_month"),
    dayOfWeek: integer("day_of_week"),
    startDate: text("start_date").notNull(),
    endDate: text("end_date"),
    lastGenerated: text("last_generated"),
    isActive: integer("is_active").notNull().default(1),
    notes: text("notes"),
    tags: text("tags"), // JSON array of strings
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_recurring_active").on(table.isActive),
    index("idx_recurring_frequency").on(table.frequency, table.isActive),
    check("recurring_type_check", sql`${table.type} IN ('income', 'expense')`),
    check(
      "recurring_frequency_check",
      sql`${table.frequency} IN ('daily', 'weekly', 'monthly', 'yearly')`
    ),
  ]
);

// ─── Transactions ─────────────────────────────────────────────────────────────

export const transactions = sqliteTable(
  "transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    amount: integer("amount").notNull(), // cents, always positive
    type: text("type").notNull().default("expense"), // 'income' | 'expense'
    description: text("description").notNull(),
    merchant: text("merchant"),
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    date: text("date").notNull(), // ISO 8601 YYYY-MM-DD
    receiptId: integer("receipt_id").references(() => receipts.id, {
      onDelete: "set null",
    }),
    recurringId: integer("recurring_id").references(() => recurringTransactions.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    tags: text("tags"), // JSON array of strings
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_transactions_date").on(table.date),
    index("idx_transactions_category").on(table.categoryId),
    index("idx_transactions_date_category").on(table.date, table.categoryId),
    index("idx_transactions_merchant").on(table.merchant),
    index("idx_transactions_amount").on(table.amount),
    index("idx_transactions_type_date").on(table.type, table.date),
    index("idx_transactions_receipt").on(table.receiptId),
    index("idx_transactions_recurring").on(table.recurringId),
    check("transactions_type_check", sql`${table.type} IN ('income', 'expense')`),
  ]
);

// ─── Budgets ──────────────────────────────────────────────────────────────────

export const budgets = sqliteTable(
  "budgets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    month: text("month").notNull(), // YYYY-MM
    amount: integer("amount").notNull(), // cents
  },
  (table) => [
    index("idx_budgets_month").on(table.month),
    index("idx_budgets_category_month").on(table.categoryId, table.month),
    uniqueIndex("uq_budgets_category_month").on(table.categoryId, table.month),
  ]
);

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Receipt = typeof receipts.$inferSelect;
export type NewReceipt = typeof receipts.$inferInsert;
export type RecurringTransaction = typeof recurringTransactions.$inferSelect;
export type NewRecurringTransaction = typeof recurringTransactions.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
