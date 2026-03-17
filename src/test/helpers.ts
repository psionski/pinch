import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import * as schema from "@/lib/db/schema";

const MIGRATIONS_FOLDER = path.resolve(__dirname, "../../drizzle");

/** Creates a fresh in-memory SQLite DB with migrations applied. Use in tests. */
export function makeTestDb() {
  const client = new Database(":memory:");
  client.pragma("journal_mode = WAL");
  client.pragma("foreign_keys = ON");
  const db = drizzle({ client, schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}
