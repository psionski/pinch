import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";
import * as schema from "./schema";

const DB_PATH = process.env.DATABASE_URL ?? "./data/pinch.db";

/**
 * Idempotently (re)creates FTS5 sync triggers for the transactions table.
 *
 * Drizzle Kit doesn't track custom triggers, so any migration that recreates
 * the transactions table (e.g. adding a CHECK constraint) silently drops them.
 * Call this after migrations and on app startup to guarantee FTS stays in sync.
 */
export function ensureFtsTriggers(client: InstanceType<typeof Database>): void {
  client.exec(`
    DROP TRIGGER IF EXISTS transactions_ai;
    DROP TRIGGER IF EXISTS transactions_ad;
    DROP TRIGGER IF EXISTS transactions_au;

    CREATE TRIGGER transactions_ai AFTER INSERT ON transactions BEGIN
      INSERT INTO transactions_fts(rowid, description, merchant, notes)
      VALUES (new.id, new.description, new.merchant, new.notes);
    END;

    CREATE TRIGGER transactions_ad AFTER DELETE ON transactions BEGIN
      INSERT INTO transactions_fts(transactions_fts, rowid, description, merchant, notes)
      VALUES ('delete', old.id, old.description, old.merchant, old.notes);
    END;

    CREATE TRIGGER transactions_au AFTER UPDATE ON transactions BEGIN
      INSERT INTO transactions_fts(transactions_fts, rowid, description, merchant, notes)
      VALUES ('delete', old.id, old.description, old.merchant, old.notes);
      INSERT INTO transactions_fts(rowid, description, merchant, notes)
      VALUES (new.id, new.description, new.merchant, new.notes);
    END;
  `);
}

function initClient(path: string): InstanceType<typeof Database> {
  mkdirSync(dirname(path), { recursive: true });
  const client = new Database(path);

  client.pragma("journal_mode = WAL");
  client.pragma("synchronous = NORMAL");
  client.pragma("foreign_keys = ON");
  client.pragma("cache_size = -64000");
  client.pragma("busy_timeout = 5000");

  return client;
}

// Singleton for the application DB connection.
// In tests, use createDb() directly with a separate path/in-memory DB.
let _db: ReturnType<typeof drizzle> | null = null;

/** App-level singleton. Assumes the DB is already migrated. */
export function getDb(): ReturnType<typeof drizzle> {
  if (!_db) {
    const client = initClient(DB_PATH);
    ensureFtsTriggers(client);
    _db = drizzle({ client, schema });
  }
  return _db;
}

/** Create a fresh DB connection — use in tests or for alternate DB paths. */
export function createDb(path: string): ReturnType<typeof drizzle> {
  const client = initClient(path);
  return drizzle({ client, schema });
}

export { schema };
