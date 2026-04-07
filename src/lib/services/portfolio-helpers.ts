import { and, asc, eq, lte, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { assetLots } from "@/lib/db/schema";
import type { AssetResponse } from "@/lib/validators/assets";

export type Db = BetterSQLite3Database<typeof schema>;

export function parseAssetRow(row: schema.Asset): AssetResponse {
  return {
    id: row.id,
    name: row.name,
    type: row.type as AssetResponse["type"],
    currency: row.currency,
    symbolMap: row.symbolMap ? (JSON.parse(row.symbolMap) as Record<string, string>) : null,
    icon: row.icon,
    color: row.color,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Sum of lot quantities for an asset up to (and including) the given date. */
export function getHoldingsAtDate(db: Db, assetId: number, date: string): number {
  const [row] = db
    .select({
      total: sql<number>`coalesce(sum(${assetLots.quantity}), 0)`.mapWith(Number),
    })
    .from(assetLots)
    .where(and(eq(assetLots.assetId, assetId), lte(assetLots.date, date)))
    .all();
  return parseFloat((row?.total ?? 0).toFixed(8));
}

/** FIFO queue entry. */
interface FifoEntry {
  qty: number;
  price: number;
  /** Per-unit price in the configured base currency, snapshotted at lot creation. */
  priceBase: number;
}

/**
 * Consume `quantity` units from the front of a FIFO buy queue.
 * Mutates the queue in-place and returns both the native and base cost of
 * consumed units.
 */
export function consumeFifo(
  queue: FifoEntry[],
  quantity: number
): { cost: number; costBase: number } {
  let toConsume = quantity;
  let cost = 0;
  let costBase = 0;
  while (toConsume > 0 && queue.length > 0) {
    const front = queue[0];
    const consumed = Math.min(front.qty, toConsume);
    cost += Math.round(consumed * front.price * 100) / 100;
    costBase += Math.round(consumed * front.priceBase * 100) / 100;
    front.qty -= consumed;
    toConsume -= consumed;
    if (front.qty <= 0) queue.shift();
  }
  return { cost, costBase };
}

/**
 * FIFO cost basis (native + base) and earliest lot date for an asset up to
 * the given date.
 */
export function getCostBasisAtDate(
  db: Db,
  assetId: number,
  date: string
): { costBasis: number; costBasisBase: number; earliestDate: string | null } {
  const lots = db
    .select({
      quantity: assetLots.quantity,
      pricePerUnit: assetLots.pricePerUnit,
      pricePerUnitBase: assetLots.pricePerUnitBase,
      date: assetLots.date,
    })
    .from(assetLots)
    .where(and(eq(assetLots.assetId, assetId), lte(assetLots.date, date)))
    .orderBy(asc(assetLots.date), asc(assetLots.id))
    .all();

  if (lots.length === 0) return { costBasis: 0, costBasisBase: 0, earliestDate: null };

  const queue: FifoEntry[] = [];
  for (const lot of lots) {
    if (lot.quantity > 0) {
      queue.push({
        qty: lot.quantity,
        price: lot.pricePerUnit,
        priceBase: lot.pricePerUnitBase,
      });
    } else {
      consumeFifo(queue, -lot.quantity);
    }
  }

  const costBasis = Math.round(queue.reduce((sum, e) => sum + e.qty * e.price, 0) * 100) / 100;
  const costBasisBase =
    Math.round(queue.reduce((sum, e) => sum + e.qty * e.priceBase, 0) * 100) / 100;
  return { costBasis, costBasisBase, earliestDate: lots[0].date };
}
