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
  type: AssetTypeSchema.describe(
    "Asset type: 'deposit' (bank/savings), 'investment' (stocks/ETFs), 'crypto', 'other'"
  ),
  currency: z
    .string()
    .min(1)
    .max(10)
    .default("EUR")
    .describe("Asset denomination currency (ISO 4217). Defaults to EUR"),
  symbolMap: SymbolMapSchema.optional().describe(
    "Provider→symbol mapping for automatic price tracking (e.g. { coingecko: 'bitcoin' }). Use search_symbol to discover symbols"
  ),
  icon: z.string().max(100).optional(),
  color: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
});
export type CreateAssetInput = z.infer<typeof CreateAssetSchema>;

export const UpdateAssetSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: AssetTypeSchema.optional(),
  currency: z.string().min(1).max(10).optional(),
  symbolMap: SymbolMapSchema.nullable()
    .optional()
    .describe(
      "Provider→symbol mapping for price tracking. Use search_symbol to discover symbols. Set to null to disable"
    ),
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
  quantity: z
    .number()
    .positive("Quantity must be positive")
    .describe("Number of units to buy (can be fractional, e.g. 0.5 BTC)"),
  pricePerUnit: z
    .number()
    .int()
    .positive("Price must be a positive integer (cents)")
    .describe("Price per unit in cents (e.g. 34563 = €345.63). For EUR deposits use 100"),
  date: IsoDateSchema.describe("Transaction date (YYYY-MM-DD)"),
  description: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});
export type BuyAssetInput = z.infer<typeof BuyAssetSchema>;

export const SellAssetSchema = z.object({
  quantity: z.number().positive("Quantity must be positive").describe("Number of units to sell"),
  pricePerUnit: z
    .number()
    .int()
    .positive("Price must be a positive integer (cents)")
    .describe("Sale price per unit in cents. For EUR withdrawals use 100"),
  date: IsoDateSchema.describe("Transaction date (YYYY-MM-DD)"),
  description: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});
export type SellAssetInput = z.infer<typeof SellAssetSchema>;

// ─── Opening Lots (onboarding) ───────────────────────────────────────────────

export const CreateOpeningLotSchema = z.object({
  quantity: z.number().positive("Quantity must be positive"),
  pricePerUnit: z.number().int().nonnegative("Price must be a non-negative integer (cents)"),
  date: IsoDateSchema,
  notes: z.string().max(2000).optional(),
});
export type CreateOpeningLotInput = z.infer<typeof CreateOpeningLotSchema>;

export const SetOpeningCashBalanceSchema = z.object({
  amount: z
    .number()
    .int()
    .positive("Amount must be a positive integer (cents)")
    .describe("Opening balance in cents (e.g. 500000 = €5,000.00)"),
  date: IsoDateSchema.optional().describe("Balance date (YYYY-MM-DD). Defaults to today"),
});
export type SetOpeningCashBalanceInput = z.infer<typeof SetOpeningCashBalanceSchema>;

export const AddOpeningAssetSchema = z.object({
  name: z.string().min(1).max(255),
  type: AssetTypeSchema.describe(
    "Asset type: 'deposit' (bank/savings), 'investment' (stocks/ETFs), 'crypto', 'other'"
  ),
  currency: z
    .string()
    .min(1)
    .max(10)
    .default("EUR")
    .describe("Asset denomination currency. Defaults to EUR"),
  quantity: z
    .number()
    .positive("Quantity must be positive")
    .describe("Number of units currently held"),
  costBasisTotal: z
    .number()
    .int()
    .positive("Cost basis must be a positive integer (cents)")
    .optional()
    .describe("Total cost basis in cents. If omitted, calculated from pricePerUnit × quantity"),
  pricePerUnit: z
    .number()
    .int()
    .positive("Price per unit must be a positive integer (cents)")
    .optional()
    .describe(
      "Cost per unit in cents. Used if costBasisTotal omitted. If neither provided, P&L starts from zero"
    ),
  symbolMap: SymbolMapSchema.optional().describe(
    "Provider→symbol mapping for price tracking. Use search_symbol to discover symbols"
  ),
  date: IsoDateSchema.optional().describe("Lot date (YYYY-MM-DD). Defaults to today"),
  icon: z.string().max(100).optional(),
  color: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
});
export type AddOpeningAssetInput = z.infer<typeof AddOpeningAssetSchema>;

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
  pricePerUnit: z
    .number()
    .int()
    .positive("Price must be a positive integer (cents)")
    .describe("Current price per unit in cents"),
  recordedAt: z.string().optional().describe("ISO 8601 datetime. Defaults to now"),
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
