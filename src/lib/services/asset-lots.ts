import { eq, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { assets, assetLots, assetPrices, transactions } from "@/lib/db/schema";
import type { BuyAssetInput, SellAssetInput, AssetLotResponse } from "@/lib/validators/assets";
import type { TransactionResponse } from "@/lib/validators/transactions";

type Db = BetterSQLite3Database<typeof schema>;

function parseLot(row: schema.AssetLot): AssetLotResponse {
  return {
    id: row.id,
    assetId: row.assetId,
    quantity: row.quantity,
    pricePerUnit: row.pricePerUnit,
    date: row.date,
    transactionId: row.transactionId,
    notes: row.notes,
    createdAt: row.createdAt,
  };
}

function parseTransaction(row: schema.Transaction): TransactionResponse {
  return {
    ...row,
    type: row.type as TransactionResponse["type"],
    tags: null,
  };
}

export class AssetLotService {
  constructor(private db: Db) {}

  /** Record a price snapshot from a transaction — every buy/sell is a price observation. */
  private recordPriceSnapshot(assetId: number, pricePerUnit: number, date: string): void {
    this.db
      .insert(assetPrices)
      .values({
        assetId,
        pricePerUnit,
        recordedAt: new Date(date).toISOString(),
      })
      .run();
  }

  buy(
    assetId: number,
    input: BuyAssetInput
  ): { lot: AssetLotResponse; transaction: TransactionResponse } {
    return this.db.transaction(() => {
      const asset = this.db.select().from(assets).where(eq(assets.id, assetId)).get();
      if (!asset) throw new Error(`Asset ${assetId} not found`);

      if (asset.type === "deposit" && asset.currency === "EUR" && input.pricePerUnit !== 100) {
        throw new Error(
          `EUR deposit: pricePerUnit must be 100 (€1.00 per unit). ` +
            `Use quantity to represent the EUR amount (e.g. quantity: 5000 for a €5,000 deposit).`
        );
      }

      const totalCents = Math.round(input.quantity * input.pricePerUnit);
      const verb = asset.type === "deposit" ? "Deposit" : "Buy";
      const description =
        input.description ??
        `${verb} ${input.quantity} ${asset.name} @ ${(input.pricePerUnit / 100).toFixed(2)} ${asset.currency}`;

      const [txRow] = this.db
        .insert(transactions)
        .values({
          amount: totalCents,
          type: "transfer",
          description,
          date: input.date,
          notes: input.notes ?? null,
        })
        .returning()
        .all();

      const [lotRow] = this.db
        .insert(assetLots)
        .values({
          assetId,
          quantity: input.quantity,
          pricePerUnit: input.pricePerUnit,
          date: input.date,
          transactionId: txRow.id,
          notes: input.notes ?? null,
        })
        .returning()
        .all();

      this.recordPriceSnapshot(assetId, input.pricePerUnit, input.date);

      return { lot: parseLot(lotRow), transaction: parseTransaction(txRow) };
    });
  }

  sell(
    assetId: number,
    input: SellAssetInput
  ): { lot: AssetLotResponse; transaction: TransactionResponse } {
    return this.db.transaction(() => {
      const asset = this.db.select().from(assets).where(eq(assets.id, assetId)).get();
      if (!asset) throw new Error(`Asset ${assetId} not found`);

      // Check sufficient holdings inside the transaction to prevent races
      const [holdingsRow] = this.db
        .select({ total: sql<number>`coalesce(sum(${assetLots.quantity}), 0)`.mapWith(Number) })
        .from(assetLots)
        .where(eq(assetLots.assetId, assetId))
        .all();
      const currentHoldings = holdingsRow?.total ?? 0;
      if (input.quantity > currentHoldings) {
        throw new Error(
          `Insufficient holdings: have ${currentHoldings}, selling ${input.quantity}`
        );
      }

      const totalCents = Math.round(input.quantity * input.pricePerUnit);
      const verb = asset.type === "deposit" ? "Withdraw" : "Sell";
      const description =
        input.description ??
        `${verb} ${input.quantity} ${asset.name} @ ${(input.pricePerUnit / 100).toFixed(2)} ${asset.currency}`;

      const [txRow] = this.db
        .insert(transactions)
        .values({
          amount: totalCents,
          type: "transfer",
          description,
          date: input.date,
          notes: input.notes ?? null,
        })
        .returning()
        .all();

      const [lotRow] = this.db
        .insert(assetLots)
        .values({
          assetId,
          quantity: -input.quantity,
          pricePerUnit: input.pricePerUnit,
          date: input.date,
          transactionId: txRow.id,
          notes: input.notes ?? null,
        })
        .returning()
        .all();

      this.recordPriceSnapshot(assetId, input.pricePerUnit, input.date);

      return { lot: parseLot(lotRow), transaction: parseTransaction(txRow) };
    });
  }

  listLots(assetId: number): AssetLotResponse[] {
    return this.db
      .select()
      .from(assetLots)
      .where(eq(assetLots.assetId, assetId))
      .orderBy(sql`${assetLots.date} DESC`)
      .all()
      .map(parseLot);
  }

  getLot(id: number): AssetLotResponse | null {
    const row = this.db.select().from(assetLots).where(eq(assetLots.id, id)).get();
    return row ? parseLot(row) : null;
  }
}
