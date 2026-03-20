-- Migrate exchange rates into the unified market_prices table.
-- Maps: base → symbol, quote → currency, rate → price.
INSERT OR IGNORE INTO `market_prices` (`symbol`, `price`, `currency`, `date`, `provider`, `fetched_at`)
SELECT `base`, `rate`, `quote`, `date`, `provider`, `fetched_at`
FROM `exchange_rates`;--> statement-breakpoint
DROP TABLE `exchange_rates`;
