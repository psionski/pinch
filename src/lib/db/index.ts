import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";
import * as schema from "./schema";

const DB_PATH = process.env.DATABASE_URL ?? "./data/pinch.db";

function createConnection(path: string): ReturnType<typeof drizzle> {
  mkdirSync(dirname(path), { recursive: true });
  const client = new Database(path);

  client.pragma("journal_mode = WAL");
  client.pragma("synchronous = NORMAL");
  client.pragma("foreign_keys = ON");
  client.pragma("cache_size = -64000");
  client.pragma("busy_timeout = 5000");

  return drizzle({ client, schema });
}

// Singleton for the application DB connection.
// In tests, use createDb() directly with a separate path/in-memory DB.
let _db: ReturnType<typeof drizzle> | null = null;

export function getDb(): ReturnType<typeof drizzle> {
  if (!_db) {
    _db = createConnection(DB_PATH);
  }
  return _db;
}

/** Create a fresh DB connection — use in tests or for alternate DB paths. */
export function createDb(path: string): ReturnType<typeof drizzle> {
  return createConnection(path);
}

export { schema };
