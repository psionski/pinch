CREATE TABLE `asset_lots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asset_id` integer NOT NULL,
	`quantity` real NOT NULL,
	`price_per_unit` integer NOT NULL,
	`date` text NOT NULL,
	`transaction_id` integer,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_asset_lots_asset` ON `asset_lots` (`asset_id`);--> statement-breakpoint
CREATE INDEX `idx_asset_lots_date` ON `asset_lots` (`asset_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_asset_lots_transaction` ON `asset_lots` (`transaction_id`);--> statement-breakpoint
CREATE TABLE `asset_prices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asset_id` integer NOT NULL,
	`price_per_unit` integer NOT NULL,
	`recorded_at` text NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_asset_prices_asset` ON `asset_prices` (`asset_id`);--> statement-breakpoint
CREATE INDEX `idx_asset_prices_latest` ON `asset_prices` (`asset_id`,`recorded_at`);--> statement-breakpoint
CREATE TABLE `assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`icon` text,
	`color` text,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	CONSTRAINT "assets_type_check" CHECK("assets"."type" IN ('deposit', 'investment', 'crypto', 'other'))
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`amount` integer NOT NULL,
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
);
--> statement-breakpoint
INSERT INTO `__new_transactions`("id", "amount", "type", "description", "merchant", "category_id", "date", "receipt_id", "recurring_id", "notes", "tags", "created_at", "updated_at") SELECT "id", "amount", "type", "description", "merchant", "category_id", "date", "receipt_id", "recurring_id", "notes", "tags", "created_at", "updated_at" FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_transactions_date` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `idx_transactions_category` ON `transactions` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_date_category` ON `transactions` (`date`,`category_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_merchant` ON `transactions` (`merchant`);--> statement-breakpoint
CREATE INDEX `idx_transactions_amount` ON `transactions` (`amount`);--> statement-breakpoint
CREATE INDEX `idx_transactions_type_date` ON `transactions` (`type`,`date`);--> statement-breakpoint
CREATE INDEX `idx_transactions_receipt` ON `transactions` (`receipt_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_recurring` ON `transactions` (`recurring_id`);