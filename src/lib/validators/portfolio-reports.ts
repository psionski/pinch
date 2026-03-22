import { z } from "zod";
import { IsoDateSchema } from "./common";

// ─── Shared Params ───────────────────────────────────────────────────────────

export const WindowSchema = z.enum(["3m", "6m", "12m", "ytd", "all"]).default("6m");
export type Window = z.infer<typeof WindowSchema>;

export const IntervalSchema = z.enum(["daily", "weekly", "monthly"]).default("monthly");
export type Interval = z.infer<typeof IntervalSchema>;

// ─── Net Worth Time Series ───────────────────────────────────────────────────

export const NetWorthQuerySchema = z.object({
  window: WindowSchema,
  interval: IntervalSchema,
});
export type NetWorthQuery = z.infer<typeof NetWorthQuerySchema>;

export const NetWorthPointSchema = z.object({
  date: z.string(),
  cash: z.number().int(),
  assets: z.number().int(),
  total: z.number().int(),
});
export type NetWorthPoint = z.infer<typeof NetWorthPointSchema>;

// ─── Asset Performance ───────────────────────────────────────────────────────

export const AssetPerformanceQuerySchema = z.object({
  from: IsoDateSchema.optional(),
  to: IsoDateSchema.optional(),
});
export type AssetPerformanceQuery = z.infer<typeof AssetPerformanceQuerySchema>;

export const AssetPerformanceItemSchema = z.object({
  assetId: z.number().int(),
  name: z.string(),
  type: z.string(),
  currency: z.string(),
  costBasis: z.number().int(),
  currentValue: z.number().int(),
  pnl: z.number().int(),
  pnlPct: z.number(),
  annualizedReturn: z.number().nullable(),
  daysHeld: z.number().int(),
});
export type AssetPerformanceItem = z.infer<typeof AssetPerformanceItemSchema>;

// ─── Allocation ──────────────────────────────────────────────────────────────

export const AllocationQuerySchema = z.object({
  historical: z.boolean().default(false),
  window: WindowSchema,
});
export type AllocationQuery = z.infer<typeof AllocationQuerySchema>;

export const AllocationItemSchema = z.object({
  assetId: z.number().int(),
  name: z.string(),
  type: z.string(),
  currentValue: z.number().int(),
  pct: z.number(),
});
export type AllocationItem = z.infer<typeof AllocationItemSchema>;

export const AllocationByTypeSchema = z.object({
  type: z.string(),
  currentValue: z.number().int(),
  pct: z.number(),
});
export type AllocationByType = z.infer<typeof AllocationByTypeSchema>;

export const AllocationResultSchema = z.object({
  byAsset: z.array(AllocationItemSchema),
  byType: z.array(AllocationByTypeSchema),
});
export type AllocationResult = z.infer<typeof AllocationResultSchema>;

// ─── Currency Exposure ───────────────────────────────────────────────────────

export const CurrencyExposureItemSchema = z.object({
  currency: z.string(),
  value: z.number().int(),
  pct: z.number(),
});
export type CurrencyExposureItem = z.infer<typeof CurrencyExposureItemSchema>;

// ─── Realized P&L ────────────────────────────────────────────────────────────

export const RealizedPnlQuerySchema = z.object({
  from: IsoDateSchema.optional(),
  to: IsoDateSchema.optional(),
});
export type RealizedPnlQuery = z.infer<typeof RealizedPnlQuerySchema>;

export const RealizedPnlItemSchema = z.object({
  assetId: z.number().int(),
  name: z.string(),
  totalSold: z.number(),
  proceeds: z.number().int(),
  costBasis: z.number().int(),
  realizedPnl: z.number().int(),
});
export type RealizedPnlItem = z.infer<typeof RealizedPnlItemSchema>;

export const RealizedPnlResultSchema = z.object({
  items: z.array(RealizedPnlItemSchema),
  totalProceeds: z.number().int(),
  totalCostBasis: z.number().int(),
  totalRealizedPnl: z.number().int(),
});
export type RealizedPnlResult = z.infer<typeof RealizedPnlResultSchema>;

// ─── Asset History ───────────────────────────────────────────────────────────

export const AssetHistoryQuerySchema = z.object({
  window: WindowSchema,
});
export type AssetHistoryQuery = z.infer<typeof AssetHistoryQuerySchema>;

export const AssetHistoryLotSchema = z.object({
  date: z.string(),
  quantity: z.number(),
  pricePerUnit: z.number().int(),
  type: z.enum(["buy", "sell"]),
  runningQuantity: z.number(),
});
export type AssetHistoryLot = z.infer<typeof AssetHistoryLotSchema>;

export const AssetHistoryPointSchema = z.object({
  date: z.string(),
  price: z.number().int().nullable(),
  quantity: z.number(),
  value: z.number().int().nullable(),
});
export type AssetHistoryPoint = z.infer<typeof AssetHistoryPointSchema>;

export const AssetHistoryResultSchema = z.object({
  lots: z.array(AssetHistoryLotSchema),
  timeline: z.array(AssetHistoryPointSchema),
});
export type AssetHistoryResult = z.infer<typeof AssetHistoryResultSchema>;

// ─── Transfer Summary ────────────────────────────────────────────────────────

export const TransferSummaryItemSchema = z.object({
  assetId: z.number().int(),
  assetName: z.string(),
  assetType: z.string(),
  purchases: z.number().int(),
  sales: z.number().int(),
  net: z.number().int(),
});
export type TransferSummaryItem = z.infer<typeof TransferSummaryItemSchema>;
