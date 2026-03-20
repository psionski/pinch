import { eq, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { assets, assetLots, assetPrices } from "@/lib/db/schema";
import type {
  CreateAssetInput,
  UpdateAssetInput,
  AssetResponse,
  AssetWithMetrics,
} from "@/lib/validators/assets";

type Db = BetterSQLite3Database<typeof schema>;

function parseAsset(row: schema.Asset): AssetResponse {
  return {
    id: row.id,
    name: row.name,
    type: row.type as AssetResponse["type"],
    currency: row.currency,
    icon: row.icon,
    color: row.color,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** For EUR deposits with no price, assume 1 unit = €1.00 (100 cents). */
function depositFallbackPrice(asset: AssetResponse): number | null {
  if (asset.type === "deposit" && asset.currency === "EUR") return 100;
  return null;
}

export class AssetService {
  constructor(private db: Db) {}

  create(input: CreateAssetInput): AssetResponse {
    const [row] = this.db
      .insert(assets)
      .values({
        name: input.name,
        type: input.type,
        currency: input.currency,
        icon: input.icon ?? null,
        color: input.color ?? null,
        notes: input.notes ?? null,
      })
      .returning()
      .all();
    return parseAsset(row);
  }

  getById(id: number): AssetWithMetrics | null {
    const row = this.db.select().from(assets).where(eq(assets.id, id)).get();
    if (!row) return null;
    return this.attachMetrics(parseAsset(row));
  }

  list(): AssetWithMetrics[] {
    const rows = this.db.select().from(assets).all();
    return rows.map((row) => this.attachMetrics(parseAsset(row)));
  }

  update(id: number, input: UpdateAssetInput): AssetResponse | null {
    const updates: Partial<schema.NewAsset> = {
      updatedAt: sql`(datetime('now'))` as unknown as string,
    };
    if (input.name !== undefined) updates.name = input.name;
    if (input.type !== undefined) updates.type = input.type;
    if (input.currency !== undefined) updates.currency = input.currency;
    if ("icon" in input) updates.icon = input.icon ?? null;
    if ("color" in input) updates.color = input.color ?? null;
    if ("notes" in input) updates.notes = input.notes ?? null;

    const [row] = this.db.update(assets).set(updates).where(eq(assets.id, id)).returning().all();
    return row ? parseAsset(row) : null;
  }

  delete(id: number): boolean {
    const result = this.db.delete(assets).where(eq(assets.id, id)).run();
    return result.changes > 0;
  }

  private attachMetrics(asset: AssetResponse): AssetWithMetrics {
    // Single query: current holdings + buy-side totals for average-cost basis.
    // Average cost = totalBuyCost / totalBoughtQty.
    // costBasis = avgCostPerUnit * currentHoldings — correctly shrinks on partial sells.
    const [lotsMetrics] = this.db
      .select({
        currentHoldings: sql<number>`coalesce(sum(${assetLots.quantity}), 0)`.mapWith(Number),
        totalBoughtQty:
          sql<number>`coalesce(sum(case when ${assetLots.quantity} > 0 then ${assetLots.quantity} else 0 end), 0)`.mapWith(
            Number
          ),
        totalBuyCost:
          sql<number>`coalesce(sum(case when ${assetLots.quantity} > 0 then cast(${assetLots.quantity} * ${assetLots.pricePerUnit} as real) else 0 end), 0)`.mapWith(
            Number
          ),
      })
      .from(assetLots)
      .where(eq(assetLots.assetId, asset.id))
      .all();

    const currentHoldings = lotsMetrics?.currentHoldings ?? 0;
    const totalBoughtQty = lotsMetrics?.totalBoughtQty ?? 0;
    const totalBuyCost = lotsMetrics?.totalBuyCost ?? 0;
    const avgCostPerUnit = totalBoughtQty > 0 ? totalBuyCost / totalBoughtQty : 0;
    const costBasis = Math.round(avgCostPerUnit * currentHoldings);

    // Latest price
    const latestPrice = this.db
      .select({ pricePerUnit: assetPrices.pricePerUnit })
      .from(assetPrices)
      .where(eq(assetPrices.assetId, asset.id))
      .orderBy(sql`${assetPrices.recordedAt} DESC`)
      .limit(1)
      .get();

    const pricePerUnit = latestPrice?.pricePerUnit ?? depositFallbackPrice(asset);

    const currentValue = pricePerUnit !== null ? Math.round(currentHoldings * pricePerUnit) : null;
    const pnl = currentValue !== null ? currentValue - costBasis : null;

    return { ...asset, currentHoldings, costBasis, currentValue, pnl };
  }
}
