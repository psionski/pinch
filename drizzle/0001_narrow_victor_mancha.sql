PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_recurring_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`amount` integer NOT NULL,
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
);
--> statement-breakpoint
INSERT INTO `__new_recurring_transactions`("id", "amount", "type", "description", "merchant", "category_id", "frequency", "day_of_month", "day_of_week", "start_date", "end_date", "last_generated", "is_active", "notes", "tags", "created_at", "updated_at") SELECT "id", "amount", "type", "description", "merchant", "category_id", "frequency", "day_of_month", "day_of_week", "start_date", "end_date", "last_generated", "is_active", "notes", "tags", "created_at", "updated_at" FROM `recurring_transactions`;--> statement-breakpoint
DROP TABLE `recurring_transactions`;--> statement-breakpoint
ALTER TABLE `__new_recurring_transactions` RENAME TO `recurring_transactions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_recurring_active` ON `recurring_transactions` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_recurring_frequency` ON `recurring_transactions` (`frequency`,`is_active`);--> statement-breakpoint
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
	CONSTRAINT "transactions_type_check" CHECK("__new_transactions"."type" IN ('income', 'expense'))
);
--> statement-breakpoint
INSERT INTO `__new_transactions`("id", "amount", "type", "description", "merchant", "category_id", "date", "receipt_id", "recurring_id", "notes", "tags", "created_at", "updated_at") SELECT "id", "amount", "type", "description", "merchant", "category_id", "date", "receipt_id", "recurring_id", "notes", "tags", "created_at", "updated_at" FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
CREATE INDEX `idx_transactions_date` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `idx_transactions_category` ON `transactions` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_date_category` ON `transactions` (`date`,`category_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_merchant` ON `transactions` (`merchant`);--> statement-breakpoint
CREATE INDEX `idx_transactions_amount` ON `transactions` (`amount`);--> statement-breakpoint
CREATE INDEX `idx_transactions_type_date` ON `transactions` (`type`,`date`);--> statement-breakpoint
CREATE INDEX `idx_transactions_receipt` ON `transactions` (`receipt_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_recurring` ON `transactions` (`recurring_id`);