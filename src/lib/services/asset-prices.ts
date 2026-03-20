import { eq, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { assetPrices } from "@/lib/db/schema";
import type { RecordPriceInput, AssetPriceResponse } from "@/lib/validators/assets";

type Db = BetterSQLite3Database<typeof schema>;

function parsePrice(row: schema.AssetPrice): AssetPriceResponse {
  return {
    id: row.id,
    assetId: row.assetId,
    pricePerUnit: row.pricePerUnit,
    recordedAt: row.recordedAt,
  };
}

export class AssetPriceService {
  constructor(private db: Db) {}

  record(assetId: number, input: RecordPriceInput): AssetPriceResponse {
    const [row] = this.db
      .insert(assetPrices)
      .values({
        assetId,
        pricePerUnit: input.pricePerUnit,
        recordedAt: input.recordedAt ?? new Date().toISOString(),
      })
      .returning()
      .all();
    return parsePrice(row);
  }

  getLatest(assetId: number): AssetPriceResponse | null {
    const row = this.db
      .select()
      .from(assetPrices)
      .where(eq(assetPrices.assetId, assetId))
      .orderBy(sql`${assetPrices.recordedAt} DESC`)
      .limit(1)
      .get();
    return row ? parsePrice(row) : null;
  }

  getHistory(assetId: number): AssetPriceResponse[] {
    return this.db
      .select()
      .from(assetPrices)
      .where(eq(assetPrices.assetId, assetId))
      .orderBy(sql`${assetPrices.recordedAt} ASC`)
      .all()
      .map(parsePrice);
  }
}
