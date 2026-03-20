import { z } from "zod";
import { IsoDateSchema } from "./common";

// ─── Asset Type ───────────────────────────────────────────────────────────────

export const AssetTypeSchema = z.enum(["deposit", "investment", "crypto", "other"]);
export type AssetType = z.infer<typeof AssetTypeSchema>;

// ─── Symbol Map ──────────────────────────────────────────────────────────────

/** Provider → symbol mapping, e.g. { coingecko: "bitcoin", "alpha-vantage": "BTC" } */
export const SymbolMapSchema = z.record(z.string(), z.string());
export type SymbolMap = z.infer<typeof SymbolMapSchema>;

// ─── Asset CRUD ───────────────────────────────────────────────────────────────

export const CreateAssetSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  type: AssetTypeSchema,
  currency: z.string().min(1).max(10).default("EUR"),
  symbolMap: SymbolMapSchema.optional(),
  icon: z.string().max(100).optional(),
  color: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
});
export type CreateAssetInput = z.infer<typeof CreateAssetSchema>;

export const UpdateAssetSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: AssetTypeSchema.optional(),
  currency: z.string().min(1).max(10).optional(),
  symbolMap: SymbolMapSchema.nullable().optional(),
  icon: z.string().max(100).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type UpdateAssetInput = z.infer<typeof UpdateAssetSchema>;

export const AssetResponseSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  type: AssetTypeSchema,
  currency: z.string(),
  symbolMap: SymbolMapSchema.nullable(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AssetResponse = z.infer<typeof AssetResponseSchema>;

export const AssetWithMetricsSchema = AssetResponseSchema.extend({
  currentHoldings: z.number(),
  costBasis: z.number().int(),
  currentValue: z.number().int().nullable(),
  pnl: z.number().int().nullable(),
  latestPrice: z.number().int().nullable(),
});
export type AssetWithMetrics = z.infer<typeof AssetWithMetricsSchema>;

// ─── Lots ─────────────────────────────────────────────────────────────────────

export const BuyAssetSchema = z.object({
  quantity: z.number().positive("Quantity must be positive"),
  pricePerUnit: z.number().int().positive("Price must be a positive integer (cents)"),
  date: IsoDateSchema,
  description: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});
export type BuyAssetInput = z.infer<typeof BuyAssetSchema>;

export const SellAssetSchema = z.object({
  quantity: z.number().positive("Quantity must be positive"),
  pricePerUnit: z.number().int().positive("Price must be a positive integer (cents)"),
  date: IsoDateSchema,
  description: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});
export type SellAssetInput = z.infer<typeof SellAssetSchema>;

export const AssetLotResponseSchema = z.object({
  id: z.number().int(),
  assetId: z.number().int(),
  quantity: z.number(),
  pricePerUnit: z.number().int(),
  date: z.string(),
  transactionId: z.number().int().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});
export type AssetLotResponse = z.infer<typeof AssetLotResponseSchema>;

// ─── Prices ───────────────────────────────────────────────────────────────────

export const RecordPriceSchema = z.object({
  pricePerUnit: z.number().int().positive("Price must be a positive integer (cents)"),
  recordedAt: z.string().optional(), // ISO 8601 datetime; defaults to now
});
export type RecordPriceInput = z.infer<typeof RecordPriceSchema>;

export const AssetPriceResponseSchema = z.object({
  id: z.number().int(),
  assetId: z.number().int(),
  pricePerUnit: z.number().int(),
  recordedAt: z.string(),
});
export type AssetPriceResponse = z.infer<typeof AssetPriceResponseSchema>;

// ─── Portfolio ────────────────────────────────────────────────────────────────

export const PortfolioAllocationSchema = z.object({
  assetId: z.number().int(),
  name: z.string(),
  currentValue: z.number().int(),
  pct: z.number(),
});

export const PortfolioResponseSchema = z.object({
  assets: z.array(AssetWithMetricsSchema),
  cashBalance: z.number().int(),
  totalAssetValue: z.number().int(),
  netWorth: z.number().int(),
  pnl: z.number().int().nullable(),
  allocation: z.array(PortfolioAllocationSchema),
});
export type PortfolioResponse = z.infer<typeof PortfolioResponseSchema>;
