-- Rebuild FTS5 index as contentless with category_name column for search.
-- Contentless (content='') lets us include joined data (category name) that
-- isn't a column on the transactions table. Triggers manage all content.

DROP TABLE IF EXISTS `transactions_fts`;--> statement-breakpoint

CREATE VIRTUAL TABLE `transactions_fts` USING fts5(
  `description`,
  `merchant`,
  `notes`,
  `category_name`,
  content='',
  content_rowid='id'
);--> statement-breakpoint

-- Populate from existing data
INSERT INTO `transactions_fts`(rowid, description, merchant, notes, category_name)
  SELECT t.id, t.description, t.merchant, t.notes, COALESCE(c.name, '')
  FROM transactions t
  LEFT JOIN categories c ON c.id = t.category_id;
