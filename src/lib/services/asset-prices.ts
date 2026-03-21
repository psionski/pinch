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

  /** Record a user-provided price override for an asset. */
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
}
