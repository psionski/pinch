import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { assets, assetPrices } from "@/lib/db/schema";
import type { RecordPriceInput, AssetPriceResponse } from "@/lib/validators/assets";
import { utcToLocal, localToUtc } from "@/lib/date-ranges";

type Db = BetterSQLite3Database<typeof schema>;

function parsePrice(row: schema.AssetPrice): AssetPriceResponse {
  return {
    id: row.id,
    assetId: row.assetId,
    pricePerUnit: row.pricePerUnit,
    recordedAt: utcToLocal(row.recordedAt),
  };
}

export class AssetPriceService {
  constructor(private db: Db) {}

  /** Record a user-provided price override for an asset. */
  record(assetId: number, input: RecordPriceInput): AssetPriceResponse {
    const asset = this.db
      .select({ id: assets.id })
      .from(assets)
      .where(eq(assets.id, assetId))
      .get();
    if (!asset) throw new Error(`Asset ${assetId} not found`);

    const [row] = this.db
      .insert(assetPrices)
      .values({
        assetId,
        pricePerUnit: input.pricePerUnit,
        recordedAt: input.recordedAt ? localToUtc(input.recordedAt) : new Date().toISOString(),
      })
      .returning()
      .all();
    return parsePrice(row);
  }
}
