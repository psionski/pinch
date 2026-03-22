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

// ─── Price (unified: exchange rates + market prices) ─────────────────────────

export const GetPriceSchema = z.object({
  symbol: z
    .string()
    .min(1)
    .describe(
      "Symbol to look up — currency code for exchange rates (e.g. 'USD'), " +
        "CoinGecko ID for crypto (e.g. 'bitcoin'), or ticker for stocks (e.g. 'AAPL')"
    ),
  currency: CurrencyCodeSchema.optional()
    .default("EUR")
    .describe("Target currency for the price. Defaults to EUR."),
  date: DateSchema.describe("Date in YYYY-MM-DD format. Defaults to today."),
});

export type GetPriceInput = z.infer<typeof GetPriceSchema>;

export const PriceResultSchema = z.object({
  symbol: z.string(),
  price: z.number(),
  currency: z.string(),
  date: z.string(),
  provider: z.string(),
  stale: z.boolean(),
});

export type PriceResultResponse = z.infer<typeof PriceResultSchema>;

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
