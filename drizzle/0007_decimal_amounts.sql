-- Migration: integer cents → decimal amounts (real columns)
-- All monetary amounts stored as plain decimal numbers instead of integer cents.
-- Uses create-copy-drop-rename pattern because SQLite has no ALTER COLUMN.

PRAGMA foreign_keys=OFF;--> statement-breakpoint

-- Drop FTS triggers before table recreation to avoid SQLITE_LOCKED.
-- The transactions table has AFTER UPDATE/DELETE triggers that fire during
-- FK cascade (ON DELETE set null) and conflict with the contentless FTS table.
-- ensureFtsTriggers() recreates them on app startup.
DROP TRIGGER IF EXISTS transactions_ai;--> statement-breakpoint
DROP TRIGGER IF EXISTS transactions_ad;--> statement-breakpoint
DROP TRIGGER IF EXISTS transactions_au;--> statement-breakpoint
DROP TRIGGER IF EXISTS categories_au_fts;--> statement-breakpoint
DROP TRIGGER IF EXISTS categories_ad_fts;--> statement-breakpoint

-- ─── receipts ────────────────────────────────────────────────────────────────
CREATE TABLE `__new_receipts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`merchant` text,
	`date` text NOT NULL,
	`total` real,
	`image_path` text,
	`raw_text` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);--> statement-breakpoint
INSERT INTO `__new_receipts`("id", "merchant", "date", "total", "image_path", "raw_text", "created_at")
  SELECT "id", "merchant", "date", CAST("total" AS REAL) / 100, "image_path", "raw_text", "created_at" FROM `receipts`;--> statement-breakpoint
DROP TABLE `receipts`;--> statement-breakpoint
ALTER TABLE `__new_receipts` RENAME TO `receipts`;--> statement-breakpoint

-- ─── recurring_transactions ──────────────────────────────────────────────────
CREATE TABLE `__new_recurring_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`amount` real NOT NULL,
	`type` text DEFAULT 'expense' NOT NULL,
	`description` text NOT NULL,
	`merchant` text,
	`category_id` integer,
	`frequency` text NOT NULL,
	`day_of_month` integer,
	`day_of_week` integer,
	`start_date` text NOT NULL,
	`end_date` text,
	`last_generated` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`notes` text,
	`tags` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "recurring_type_check" CHECK("__new_recurring_transactions"."type" IN ('income', 'expense')),
	CONSTRAINT "recurring_frequency_check" CHECK("__new_recurring_transactions"."frequency" IN ('daily', 'weekly', 'monthly', 'yearly'))
);--> statement-breakpoint
INSERT INTO `__new_recurring_transactions`("id", "amount", "type", "description", "merchant", "category_id", "frequency", "day_of_month", "day_of_week", "start_date", "end_date", "last_generated", "is_active", "notes", "tags", "created_at", "updated_at")
  SELECT "id", CAST("amount" AS REAL) / 100, "type", "description", "merchant", "category_id", "frequency", "day_of_month", "day_of_week", "start_date", "end_date", "last_generated", "is_active", "notes", "tags", "created_at", "updated_at" FROM `recurring_transactions`;--> statement-breakpoint
DROP TABLE `recurring_transactions`;--> statement-breakpoint
ALTER TABLE `__new_recurring_transactions` RENAME TO `recurring_transactions`;--> statement-breakpoint
CREATE INDEX `idx_recurring_active` ON `recurring_transactions` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_recurring_frequency` ON `recurring_transactions` (`frequency`,`is_active`);--> statement-breakpoint

-- ─── transactions ────────────────────────────────────────────────────────────
CREATE TABLE `__new_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`amount` real NOT NULL,
	`type` text DEFAULT 'expense' NOT NULL,
	`description` text NOT NULL,
	`merchant` text,
	`category_id` integer,
	`date` text NOT NULL,
	`receipt_id` integer,
	`recurring_id` integer,
	`notes` text,
	`tags` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`receipt_id`) REFERENCES `receipts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`recurring_id`) REFERENCES `recurring_transactions`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "transactions_type_check" CHECK("__new_transactions"."type" IN ('income', 'expense', 'transfer'))
);--> statement-breakpoint
INSERT INTO `__new_transactions`("id", "amount", "type", "description", "merchant", "category_id", "date", "receipt_id", "recurring_id", "notes", "tags", "created_at", "updated_at")
  SELECT "id", CAST("amount" AS REAL) / 100, "type", "description", "merchant", "category_id", "date", "receipt_id", "recurring_id", "notes", "tags", "created_at", "updated_at" FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
CREATE INDEX `idx_transactions_date` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `idx_transactions_category` ON `transactions` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_date_category` ON `transactions` (`date`,`category_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_merchant` ON `transactions` (`merchant`);--> statement-breakpoint
CREATE INDEX `idx_transactions_amount` ON `transactions` (`amount`);--> statement-breakpoint
CREATE INDEX `idx_transactions_type_date` ON `transactions` (`type`,`date`);--> statement-breakpoint
CREATE INDEX `idx_transactions_receipt` ON `transactions` (`receipt_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_recurring` ON `transactions` (`recurring_id`);--> statement-breakpoint

-- ─── budgets ─────────────────────────────────────────────────────────────────
CREATE TABLE `__new_budgets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`month` text NOT NULL,
	`amount` real NOT NULL,
	`deleted` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `__new_budgets`("id", "category_id", "month", "amount", "deleted")
  SELECT "id", "category_id", "month", CAST("amount" AS REAL) / 100, "deleted" FROM `budgets`;--> statement-breakpoint
DROP TABLE `budgets`;--> statement-breakpoint
ALTER TABLE `__new_budgets` RENAME TO `budgets`;--> statement-breakpoint
CREATE INDEX `idx_budgets_month` ON `budgets` (`month`);--> statement-breakpoint
CREATE INDEX `idx_budgets_category_month` ON `budgets` (`category_id`,`month`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_budgets_category_month` ON `budgets` (`category_id`,`month`);--> statement-breakpoint

-- ─── market_prices ───────────────────────────────────────────────────────────
CREATE TABLE `__new_market_prices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`symbol` text NOT NULL,
	`price` real NOT NULL,
	`currency` text NOT NULL,
	`date` text NOT NULL,
	`provider` text NOT NULL,
	`fetched_at` text DEFAULT (datetime('now')) NOT NULL
);--> statement-breakpoint
INSERT INTO `__new_market_prices`("id", "symbol", "price", "currency", "date", "provider", "fetched_at")
  SELECT "id", "symbol", CAST("price" AS REAL), "currency", "date", "provider", "fetched_at" FROM `market_prices`;--> statement-breakpoint
DROP TABLE `market_prices`;--> statement-breakpoint
ALTER TABLE `__new_market_prices` RENAME TO `market_prices`;--> statement-breakpoint
CREATE INDEX `idx_market_prices_symbol` ON `market_prices` (`symbol`,`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_market_prices_symbol_currency_date` ON `market_prices` (`symbol`,`currency`,`date`);--> statement-breakpoint

-- ─── asset_lots ──────────────────────────────────────────────────────────────
CREATE TABLE `__new_asset_lots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asset_id` integer NOT NULL,
	`quantity` real NOT NULL,
	`price_per_unit` real NOT NULL,
	`date` text NOT NULL,
	`transaction_id` integer,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
INSERT INTO `__new_asset_lots`("id", "asset_id", "quantity", "price_per_unit", "date", "transaction_id", "notes", "created_at")
  SELECT "id", "asset_id", "quantity", CAST("price_per_unit" AS REAL) / 100, "date", "transaction_id", "notes", "created_at" FROM `asset_lots`;--> statement-breakpoint
DROP TABLE `asset_lots`;--> statement-breakpoint
ALTER TABLE `__new_asset_lots` RENAME TO `asset_lots`;--> statement-breakpoint
CREATE INDEX `idx_asset_lots_asset` ON `asset_lots` (`asset_id`);--> statement-breakpoint
CREATE INDEX `idx_asset_lots_date` ON `asset_lots` (`asset_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_asset_lots_transaction` ON `asset_lots` (`transaction_id`);--> statement-breakpoint

-- ─── asset_prices ────────────────────────────────────────────────────────────
CREATE TABLE `__new_asset_prices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asset_id` integer NOT NULL,
	`price_per_unit` real NOT NULL,
	`recorded_at` text NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `__new_asset_prices`("id", "asset_id", "price_per_unit", "recorded_at")
  SELECT "id", "asset_id", CAST("price_per_unit" AS REAL) / 100, "recorded_at" FROM `asset_prices`;--> statement-breakpoint
DROP TABLE `asset_prices`;--> statement-breakpoint
ALTER TABLE `__new_asset_prices` RENAME TO `asset_prices`;--> statement-breakpoint
CREATE INDEX `idx_asset_prices_asset` ON `asset_prices` (`asset_id`);--> statement-breakpoint
CREATE INDEX `idx_asset_prices_latest` ON `asset_prices` (`asset_id`,`recorded_at`);--> statement-breakpoint

PRAGMA foreign_keys=ON;--> statement-breakpoint

-- FTS5 triggers are automatically recreated by ensureFtsTriggers() on app startup.
-- Re-populate contentless FTS index since the transactions table was recreated.
INSERT INTO `transactions_fts`(rowid, description, merchant, notes, category_name)
  SELECT t.id, t.description, t.merchant, t.notes, COALESCE(c.name, '')
  FROM transactions t
  LEFT JOIN categories c ON c.id = t.category_id;
