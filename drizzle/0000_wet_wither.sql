CREATE TABLE `budgets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`month` text NOT NULL,
	`amount` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_budgets_month` ON `budgets` (`month`);--> statement-breakpoint
CREATE INDEX `idx_budgets_category_month` ON `budgets` (`category_id`,`month`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_budgets_category_month` ON `budgets` (`category_id`,`month`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`parent_id` integer,
	`icon` text,
	`color` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_unique` ON `categories` (`name`);--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`merchant` text,
	`date` text NOT NULL,
	`total` integer,
	`image_path` text,
	`raw_text` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recurring_transactions` (
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
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_recurring_active` ON `recurring_transactions` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_recurring_frequency` ON `recurring_transactions` (`frequency`,`is_active`);--> statement-breakpoint
CREATE TABLE `transactions` (
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
	FOREIGN KEY (`recurring_id`) REFERENCES `recurring_transactions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_transactions_date` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `idx_transactions_category` ON `transactions` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_date_category` ON `transactions` (`date`,`category_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_merchant` ON `transactions` (`merchant`);--> statement-breakpoint
CREATE INDEX `idx_transactions_amount` ON `transactions` (`amount`);--> statement-breakpoint
CREATE INDEX `idx_transactions_type_date` ON `transactions` (`type`,`date`);--> statement-breakpoint
CREATE INDEX `idx_transactions_receipt` ON `transactions` (`receipt_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_recurring` ON `transactions` (`recurring_id`);--> statement-breakpoint
CREATE VIRTUAL TABLE `transactions_fts` USING fts5(
  `description`,
  `merchant`,
  `notes`,
  content='transactions',
  content_rowid='id'
);--> statement-breakpoint
CREATE TRIGGER `transactions_ai` AFTER INSERT ON `transactions` BEGIN
  INSERT INTO `transactions_fts`(rowid, description, merchant, notes)
  VALUES (new.id, new.description, new.merchant, new.notes);
END;--> statement-breakpoint
CREATE TRIGGER `transactions_ad` AFTER DELETE ON `transactions` BEGIN
  INSERT INTO `transactions_fts`(`transactions_fts`, rowid, description, merchant, notes)
  VALUES ('delete', old.id, old.description, old.merchant, old.notes);
END;--> statement-breakpoint
CREATE TRIGGER `transactions_au` AFTER UPDATE ON `transactions` BEGIN
  INSERT INTO `transactions_fts`(`transactions_fts`, rowid, description, merchant, notes)
  VALUES ('delete', old.id, old.description, old.merchant, old.notes);
  INSERT INTO `transactions_fts`(rowid, description, merchant, notes)
  VALUES (new.id, new.description, new.merchant, new.notes);
END;