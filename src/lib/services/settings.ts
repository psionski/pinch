import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { settings } from "@/lib/db/schema";

type Db = BetterSQLite3Database<typeof schema>;

export class SettingsService {
  constructor(private db: Db) {}

  /** Get a setting value by key. Returns null if not set. */
  get(key: string): string | null {
    const row = this.db.select().from(settings).where(eq(settings.key, key)).get();
    return row?.value ?? null;
  }

  /** Set a setting value (upsert). */
  set(key: string, value: string): void {
    this.db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } })
      .run();
  }

  /** Delete a setting by key. Returns true if it existed. */
  delete(key: string): boolean {
    const existing = this.db
      .select({ key: settings.key })
      .from(settings)
      .where(eq(settings.key, key))
      .get();
    if (!existing) return false;
    this.db.delete(settings).where(eq(settings.key, key)).run();
    return true;
  }

  /** List all settings as key-value pairs. */
  list(): Array<{ key: string; value: string }> {
    return this.db.select().from(settings).all();
  }

  /** Get the user's IANA timezone. Returns null if not yet configured. */
  getTimezone(): string | null {
    return this.get("timezone");
  }

  /** Set the user's IANA timezone. Throws on invalid identifier. */
  setTimezone(tz: string): void {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
    } catch {
      throw new Error(`Invalid IANA timezone: ${tz}`);
    }
    this.set("timezone", tz);
  }
}
