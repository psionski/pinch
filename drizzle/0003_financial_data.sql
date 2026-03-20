CREATE TABLE `exchange_rates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`base` text NOT NULL,
	`quote` text NOT NULL,
	`rate` text NOT NULL,
	`date` text NOT NULL,
	`provider` text NOT NULL,
	`fetched_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_exchange_rates_pair` ON `exchange_rates` (`base`,`quote`,`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_exchange_rates_pair_date` ON `exchange_rates` (`base`,`quote`,`date`);--> statement-breakpoint
CREATE TABLE `market_prices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`symbol` text NOT NULL,
	`price` text NOT NULL,
	`currency` text NOT NULL,
	`date` text NOT NULL,
	`provider` text NOT NULL,
	`fetched_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_market_prices_symbol` ON `market_prices` (`symbol`,`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_market_prices_symbol_currency_date` ON `market_prices` (`symbol`,`currency`,`date`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
