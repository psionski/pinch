import { z } from "zod";
import type { ZodOpenApiOperationObject } from "zod-openapi";
import {
  CreateAssetSchema,
  UpdateAssetSchema,
  BuyAssetSchema,
  SellAssetSchema,
  RecordPriceSchema,
  AssetWithMetricsSchema,
  AssetLotResponseSchema,
  AssetPriceResponseSchema,
} from "@/lib/validators/assets";
import {
  AssetHistoryQuerySchema,
  AssetHistoryResultSchema,
} from "@/lib/validators/portfolio-reports";
import { op, SuccessSchema, ErrorSchema, Transaction } from "./helpers";

const AssetHistoryResult = AssetHistoryResultSchema.meta({ id: "AssetHistoryResult" });
const AssetWithMetrics = AssetWithMetricsSchema.meta({ id: "AssetWithMetrics" });
const AssetLot = AssetLotResponseSchema.meta({ id: "AssetLot" });
const AssetPrice = AssetPriceResponseSchema.meta({ id: "AssetPrice" });

export const assetPaths = {
  "/api/assets": {
    get: op({
      id: "listAssets",
      summary: "List all assets with metrics",
      tags: ["Assets"],
      response: z.array(AssetWithMetrics),
      errors: [500],
    }),
    post: op({
      id: "createAsset",
      summary: "Create a new asset",
      tags: ["Assets"],
      body: CreateAssetSchema,
      response: AssetWithMetrics,
      status: 201,
      errors: [400, 500],
    }),
  },
  "/api/assets/{id}": {
    get: op({
      id: "getAssetById",
      summary: "Get an asset by ID with metrics",
      tags: ["Assets"],
      pathId: "Asset ID",
      response: AssetWithMetrics,
      errors: [400, 404, 500],
    }),
    patch: op({
      id: "updateAsset",
      summary: "Update asset metadata",
      tags: ["Assets"],
      pathId: "Asset ID",
      body: UpdateAssetSchema,
      response: AssetWithMetrics,
      errors: [400, 404, 500],
    }),
    delete: op({
      id: "deleteAsset",
      summary: "Delete an asset and its lots and prices",
      tags: ["Assets"],
      pathId: "Asset ID",
      response: SuccessSchema,
      errors: [400, 404, 500],
    }),
  },
  "/api/assets/{id}/buy": {
    post: op({
      id: "buyAsset",
      summary: "Record an asset purchase — creates a negative transfer transaction + lot",
      tags: ["Assets"],
      pathId: "Asset ID",
      body: BuyAssetSchema,
      response: z.object({ lot: AssetLot, transaction: Transaction }),
      status: 201,
      errors: [400, 404, 500],
    }),
  },
  "/api/assets/{id}/sell": {
    post: op({
      id: "sellAsset",
      summary: "Record an asset sale — creates a positive transfer transaction + negative lot",
      tags: ["Assets"],
      pathId: "Asset ID",
      body: SellAssetSchema,
      response: z.object({ lot: AssetLot, transaction: Transaction }),
      status: 201,
      errors: [400, 404, 409, 500],
    }),
  },
  "/api/assets/{id}/lots": {
    get: op({
      id: "listAssetLots",
      summary: "List buy/sell lot history for an asset",
      tags: ["Assets"],
      pathId: "Asset ID",
      response: z.array(AssetLot),
      errors: [400, 500],
    }),
  },
  "/api/assets/{id}/prices": {
    get: op({
      id: "getAssetPriceHistory",
      summary: "Get price history for an asset",
      tags: ["Assets"],
      pathId: "Asset ID",
      response: z.array(AssetPrice),
      errors: [400, 500],
    }),
    post: op({
      id: "recordAssetPrice",
      summary: "Record a price snapshot for an asset",
      tags: ["Assets"],
      pathId: "Asset ID",
      body: RecordPriceSchema,
      response: AssetPrice,
      status: 201,
      errors: [400, 404, 500],
    }),
  },
  "/api/assets/{id}/history": {
    get: {
      operationId: "getAssetHistory",
      summary: "Combined lot + price timeline for one asset",
      tags: ["Portfolio Reports"],
      requestParams: {
        path: z.object({ id: z.string().meta({ description: "Asset ID" }) }),
        query: AssetHistoryQuerySchema,
      },
      responses: {
        "200": {
          description: "Asset history with lots and price timeline",
          content: { "application/json": { schema: AssetHistoryResult } },
        },
        "404": {
          description: "Asset not found",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    } satisfies ZodOpenApiOperationObject,
  },
};
