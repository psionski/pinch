import { z } from "zod";
import type { ZodOpenApiOperationObject } from "zod-openapi";
import {
  GetPriceSchema,
  ConvertCurrencySchema,
  PriceResultSchema,
  ConvertResultSchema,
  ProviderStatusSchema,
  SetApiKeyBodySchema,
  SearchSymbolQuerySchema,
} from "@/lib/validators/financial";
import { ProviderNameSchema } from "@/lib/providers/types";
import { op, ErrorSchema } from "./helpers";

const PriceResult = PriceResultSchema.meta({ id: "PriceResult" });
const ConvertResult = ConvertResultSchema.meta({ id: "ConvertResult" });
const ProviderStatus = ProviderStatusSchema.meta({ id: "ProviderStatus" });
const SymbolSearchResult = z
  .object({
    provider: ProviderNameSchema,
    symbol: z.string(),
    name: z.string(),
    type: z.string().optional(),
  })
  .meta({ id: "SymbolSearchResult" });

export const financialPaths = {
  "/api/financial/price": {
    get: op({
      id: "getPrice",
      summary: "Get a price for a currency pair, crypto, stock, or ETF",
      tags: ["Financial"],
      query: GetPriceSchema,
      response: PriceResult,
      errors: [400, 404, 500],
    }),
  },
  "/api/financial/convert": {
    get: op({
      id: "convertCurrency",
      summary: "Convert an amount between currencies",
      tags: ["Financial"],
      query: ConvertCurrencySchema,
      response: ConvertResult,
      errors: [400, 404, 500],
    }),
  },
  "/api/financial/providers": {
    get: op({
      id: "listProviders",
      summary: "List financial data providers with their status",
      tags: ["Financial"],
      response: z.array(ProviderStatus),
      errors: [500],
    }),
  },
  "/api/financial/search-symbol": {
    get: {
      operationId: "searchSymbol",
      summary: "Search for market symbols across providers (SSE stream)",
      tags: ["Financial"],
      requestParams: {
        query: SearchSymbolQuerySchema,
      },
      responses: {
        "200": {
          description:
            "SSE stream. Events: 'results' (provider + results array per batch), 'done' (stream complete).",
          content: {
            "text/event-stream": {
              schema: z.object({
                provider: ProviderNameSchema,
                results: z.array(SymbolSearchResult),
              }),
            },
          },
        },
        "400": {
          description: "Validation error",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    } satisfies ZodOpenApiOperationObject,
  },
  "/api/financial/providers/{provider}/key": {
    post: {
      operationId: "setProviderApiKey",
      summary: "Set an API key for a financial data provider",
      tags: ["Financial"],
      requestParams: {
        path: z.object({
          provider: z.string().meta({
            description: "Provider name (open-exchange-rates, coingecko, alpha-vantage)",
          }),
        }),
      },
      requestBody: {
        required: true,
        content: { "application/json": { schema: SetApiKeyBodySchema } },
      },
      responses: {
        "200": {
          description: "API key set",
          content: {
            "application/json": {
              schema: z.object({ success: z.boolean(), provider: z.string() }),
            },
          },
        },
        "400": {
          description: "Validation error",
          content: { "application/json": { schema: ErrorSchema } },
        },
        "500": {
          description: "Internal server error",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    } satisfies ZodOpenApiOperationObject,
  },
};
