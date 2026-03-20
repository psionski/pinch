import { z } from "zod";

// ─── Common ───────────────────────────────────────────────────────────────────

const CurrencyCodeSchema = z
  .string()
  .min(2)
  .max(10)
  .toUpperCase()
  .describe("ISO 4217 currency code or crypto symbol (e.g. USD, EUR, BTC)");

const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .optional();

// ─── Exchange Rate ─────────────────────────────────────────────────────────────

export const GetExchangeRateSchema = z.object({
  base: CurrencyCodeSchema.describe("Base currency code (e.g. USD)"),
  quote: CurrencyCodeSchema.describe("Quote currency code (e.g. EUR)"),
  date: DateSchema.describe("Date in YYYY-MM-DD format. Defaults to today."),
});

export type GetExchangeRateInput = z.infer<typeof GetExchangeRateSchema>;

export const ExchangeRateResultSchema = z.object({
  base: z.string(),
  quote: z.string(),
  rate: z.number(),
  date: z.string(),
  provider: z.string(),
  stale: z.boolean(),
});

export type ExchangeRateResultResponse = z.infer<typeof ExchangeRateResultSchema>;

// ─── Convert Currency ─────────────────────────────────────────────────────────

export const ConvertCurrencySchema = z.object({
  amount: z.number().int().describe("Amount in cents to convert (e.g. 1599 = €15.99)"),
  from: CurrencyCodeSchema.describe("Source currency code"),
  to: CurrencyCodeSchema.describe("Target currency code"),
  date: DateSchema.describe("Date for the exchange rate. Defaults to today."),
});

export type ConvertCurrencyInput = z.infer<typeof ConvertCurrencySchema>;

export const ConvertResultSchema = z.object({
  converted: z.number().int().describe("Converted amount in cents"),
  rate: z.number(),
  date: z.string(),
  provider: z.string(),
  stale: z.boolean(),
});

export type ConvertResultResponse = z.infer<typeof ConvertResultSchema>;

// ─── Market Price ─────────────────────────────────────────────────────────────

export const GetMarketPriceSchema = z.object({
  symbol: z.string().min(1).describe("Asset symbol or CoinGecko ID (e.g. 'bitcoin', 'AAPL')"),
  currency: CurrencyCodeSchema.optional()
    .default("EUR")
    .describe("Target currency for the price. Defaults to EUR."),
  date: DateSchema.describe("Date in YYYY-MM-DD format. Defaults to today."),
});

export type GetMarketPriceInput = z.infer<typeof GetMarketPriceSchema>;

export const MarketPriceResultSchema = z.object({
  symbol: z.string(),
  price: z.number(),
  currency: z.string(),
  date: z.string(),
  provider: z.string(),
  stale: z.boolean(),
});

export type MarketPriceResultResponse = z.infer<typeof MarketPriceResultSchema>;

// ─── Providers ────────────────────────────────────────────────────────────────

export const SetApiKeySchema = z.object({
  provider: z.enum(["open-exchange-rates", "coingecko", "alpha-vantage"]).describe("Provider name"),
  key: z.string().min(1).describe("API key for the provider"),
});

export type SetApiKeyInput = z.infer<typeof SetApiKeySchema>;

export const ProviderStatusSchema = z.object({
  name: z.string(),
  type: z.enum(["exchange-rates", "market-prices", "both"]),
  apiKeyRequired: z.boolean(),
  apiKeySet: z.boolean(),
  healthy: z.boolean().nullable(),
});

export type ProviderStatusResponse = z.infer<typeof ProviderStatusSchema>;

// ─── API route param schemas ───────────────────────────────────────────────────

export const SetApiKeyBodySchema = z.object({
  key: z.string().min(1),
});

export const ProviderNameSchema = z.object({
  provider: z.enum(["open-exchange-rates", "coingecko", "alpha-vantage"]),
});
