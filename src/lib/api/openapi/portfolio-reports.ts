import { z } from "zod";
import type { ZodOpenApiOperationObject } from "zod-openapi";
import {
  NetWorthQuerySchema,
  NetWorthPointSchema,
  AssetPerformanceQuerySchema,
  AssetPerformanceItemSchema,
  AllocationResultSchema,
  CurrencyExposureItemSchema,
  RealizedPnlQuerySchema,
  RealizedPnlResultSchema,
} from "@/lib/validators/portfolio-reports";
import { PortfolioResponseSchema } from "@/lib/validators/assets";
import { op } from "./helpers";

const Portfolio = PortfolioResponseSchema.meta({ id: "Portfolio" });
const NetWorthPoint = NetWorthPointSchema.meta({ id: "NetWorthPoint" });
const AssetPerformanceItem = AssetPerformanceItemSchema.meta({ id: "AssetPerformanceItem" });
const AllocationResult = AllocationResultSchema.meta({ id: "AllocationResult" });
const CurrencyExposureItem = CurrencyExposureItemSchema.meta({ id: "CurrencyExposureItem" });
const RealizedPnlResult = RealizedPnlResultSchema.meta({ id: "RealizedPnlResult" });

export const portfolioReportPaths = {
  "/api/portfolio/net-worth": {
    get: {
      operationId: "getNetWorthHistory",
      summary: "Net worth time series",
      tags: ["Portfolio Reports"],
      requestParams: {
        query: NetWorthQuerySchema,
      },
      responses: {
        "200": {
          description: "Net worth time series",
          content: { "application/json": { schema: z.array(NetWorthPoint) } },
        },
      },
    } satisfies ZodOpenApiOperationObject,
  },
  "/api/portfolio/performance": {
    get: {
      operationId: "getAssetPerformance",
      summary: "All assets ranked by performance",
      tags: ["Portfolio Reports"],
      requestParams: {
        query: AssetPerformanceQuerySchema,
      },
      responses: {
        "200": {
          description: "Asset performance table",
          content: { "application/json": { schema: z.array(AssetPerformanceItem) } },
        },
      },
    } satisfies ZodOpenApiOperationObject,
  },
  "/api/portfolio/allocation": {
    get: {
      operationId: "getAllocation",
      summary: "Portfolio allocation by asset and type",
      tags: ["Portfolio Reports"],
      responses: {
        "200": {
          description: "Allocation breakdown",
          content: { "application/json": { schema: AllocationResult } },
        },
      },
    } satisfies ZodOpenApiOperationObject,
  },
  "/api/portfolio/currency-exposure": {
    get: {
      operationId: "getCurrencyExposure",
      summary: "Net worth by currency",
      tags: ["Portfolio Reports"],
      responses: {
        "200": {
          description: "Currency exposure breakdown",
          content: { "application/json": { schema: z.array(CurrencyExposureItem) } },
        },
      },
    } satisfies ZodOpenApiOperationObject,
  },
  "/api/portfolio/realized-pnl": {
    get: {
      operationId: "getRealizedPnl",
      summary: "Realized P&L from sells",
      tags: ["Portfolio Reports"],
      requestParams: {
        query: RealizedPnlQuerySchema,
      },
      responses: {
        "200": {
          description: "Realized P&L breakdown",
          content: { "application/json": { schema: RealizedPnlResult } },
        },
      },
    } satisfies ZodOpenApiOperationObject,
  },
  "/api/portfolio": {
    get: op({
      id: "getPortfolio",
      summary: "Get net worth, asset allocation, and aggregate P&L",
      tags: ["Assets"],
      response: Portfolio,
      errors: [500],
    }),
  },
};
