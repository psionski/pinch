import { z, type ZodType } from "zod";
import { createDocument, type ZodOpenApiOperationObject } from "zod-openapi";
import {
  CreateTransactionSchema,
  UpdateTransactionSchema,
  ListTransactionsSchema,
  TransactionResponseSchema,
  PaginatedTransactionsResponseSchema,
} from "@/lib/validators/transactions";
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  RecategorizeSchema,
  MergeCategoriesSchema,
  CategoryResponseSchema,
  CategoryWithCountResponseSchema,
} from "@/lib/validators/categories";
import {
  SetBudgetSchema,
  GetBudgetStatusSchema,
  DeleteBudgetSchema,
  ResetBudgetsSchema,
  BudgetHistorySchema,
  BudgetResponseSchema,
} from "@/lib/validators/budgets";
import {
  CreateRecurringSchema,
  UpdateRecurringSchema,
  RecurringResponseSchema,
} from "@/lib/validators/recurring";
import {
  ReceiptResponseSchema,
  ListReceiptsSchema,
  DeleteReceiptsBatchSchema,
} from "@/lib/validators/receipts";
import {
  GetPriceSchema,
  ConvertCurrencySchema,
  PriceResultSchema,
  ConvertResultSchema,
  ProviderStatusSchema,
  SetApiKeyBodySchema,
} from "@/lib/validators/financial";
import {
  CreateAssetSchema,
  UpdateAssetSchema,
  BuyAssetSchema,
  SellAssetSchema,
  RecordPriceSchema,
  AssetWithMetricsSchema,
  AssetLotResponseSchema,
  AssetPriceResponseSchema,
  PortfolioResponseSchema,
} from "@/lib/validators/assets";
import {
  SpendingSummarySchema,
  CategoryStatsSchema,
  BudgetStatsSchema,
  TrendsSchema,
  TopMerchantsSchema,
  SpendingSummaryResultSchema,
  CategorySpendingItemSchema,
  BudgetStatsItemSchema,
  TrendPointSchema,
  TopMerchantSchema,
  BudgetStatusItemSchema,
} from "@/lib/validators/reports";
import {
  NetWorthQuerySchema,
  NetWorthPointSchema,
  AssetPerformanceQuerySchema,
  AssetPerformanceItemSchema,
  AllocationResultSchema,
  CurrencyExposureItemSchema,
  RealizedPnlQuerySchema,
  RealizedPnlResultSchema,
  AssetHistoryQuerySchema,
  AssetHistoryResultSchema,
} from "@/lib/validators/portfolio-reports";
import { ErrorResponseSchema } from "@/lib/validators/common";

// ─── Named component schemas ────────────────────────────────────────────────

const ErrorSchema = ErrorResponseSchema.meta({ id: "ErrorResponse" });
const AssetWithMetrics = AssetWithMetricsSchema.meta({ id: "AssetWithMetrics" });
const AssetLot = AssetLotResponseSchema.meta({ id: "AssetLot" });
const AssetPrice = AssetPriceResponseSchema.meta({ id: "AssetPrice" });
const Portfolio = PortfolioResponseSchema.meta({ id: "Portfolio" });
const PriceResult = PriceResultSchema.meta({ id: "PriceResult" });
const ConvertResult = ConvertResultSchema.meta({ id: "ConvertResult" });
const ProviderStatus = ProviderStatusSchema.meta({ id: "ProviderStatus" });
const SuccessSchema = z.object({ success: z.boolean() }).meta({ id: "SuccessResponse" });
const Transaction = TransactionResponseSchema.meta({ id: "Transaction" });
const PaginatedTransactions = PaginatedTransactionsResponseSchema.meta({
  id: "PaginatedTransactions",
});
const Category = CategoryResponseSchema.meta({ id: "Category" });
const CategoryWithCount = CategoryWithCountResponseSchema.meta({ id: "CategoryWithCount" });
const Budget = BudgetResponseSchema.meta({ id: "Budget" });
const BudgetStatus = BudgetStatusItemSchema.meta({ id: "BudgetStatusItem" });
const Recurring = RecurringResponseSchema.meta({ id: "RecurringTemplate" });
const ReceiptRecord = ReceiptResponseSchema.meta({ id: "Receipt" });
const NetWorthPoint = NetWorthPointSchema.meta({ id: "NetWorthPoint" });
const AssetPerformanceItem = AssetPerformanceItemSchema.meta({ id: "AssetPerformanceItem" });
const AllocationResult = AllocationResultSchema.meta({ id: "AllocationResult" });
const CurrencyExposureItem = CurrencyExposureItemSchema.meta({ id: "CurrencyExposureItem" });
const RealizedPnlResult = RealizedPnlResultSchema.meta({ id: "RealizedPnlResult" });
const AssetHistoryResult = AssetHistoryResultSchema.meta({ id: "AssetHistoryResult" });
const SummaryResult = SpendingSummaryResultSchema.meta({ id: "SpendingSummaryResult" });
const CategorySpendingItem = CategorySpendingItemSchema.meta({ id: "CategorySpendingItem" });
const BudgetStatsItem = BudgetStatsItemSchema.meta({ id: "BudgetStatsItem" });
const Trend = TrendPointSchema.meta({ id: "TrendPoint" });
const Merchant = TopMerchantSchema.meta({ id: "TopMerchant" });

// ─── Operation builder ──────────────────────────────────────────────────────

const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: "Validation error",
  404: "Not found",
  409: "Conflict",
  500: "Internal server error",
};

interface OpConfig {
  id: string;
  summary: string;
  tags: string[];
  query?: ZodType;
  body?: ZodType;
  pathId?: string;
  response: ZodType;
  status?: number;
  errors: number[];
}

function op(cfg: OpConfig): ZodOpenApiOperationObject {
  // Build responses — use Object.fromEntries to satisfy the template literal index type
  const entries: Array<
    [string, { description: string; content?: Record<string, { schema: ZodType }> }]
  > = [];

  entries.push([
    String(cfg.status ?? 200),
    {
      description: cfg.summary,
      content: { "application/json": { schema: cfg.response } },
    },
  ]);
  for (const code of cfg.errors) {
    entries.push([
      String(code),
      {
        description: ERROR_DESCRIPTIONS[code] ?? "Error",
        content: { "application/json": { schema: ErrorSchema } },
      },
    ]);
  }

  const result: ZodOpenApiOperationObject = {
    operationId: cfg.id,
    summary: cfg.summary,
    tags: cfg.tags,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    responses: Object.fromEntries(entries) as any,
  };

  if (cfg.pathId) {
    result.requestParams = {
      path: z.object({ id: z.string().meta({ description: cfg.pathId }) }),
    };
  }
  if (cfg.query) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result.requestParams = { ...result.requestParams, query: cfg.query as any };
  }
  if (cfg.body) {
    result.requestBody = {
      required: true,
      content: { "application/json": { schema: cfg.body } },
    };
  }

  return result;
}

// ─── Document ───────────────────────────────────────────────────────────────

export function generateOpenApiDocument(): ReturnType<typeof createDocument> {
  return createDocument({
    openapi: "3.1.0",
    info: {
      title: "Pinch API",
      version: "1.0.0",
      description:
        "Personal finance tracker API. All monetary amounts are integers in cents (e.g. 1210 = €12.10).",
    },
    tags: [
      { name: "Transactions", description: "Transaction CRUD and listing" },
      { name: "Categories", description: "Category management, recategorize, and merge" },
      { name: "Reports", description: "Spending reports, trends, and breakdowns" },
      { name: "Budgets", description: "Monthly budget management" },
      { name: "Recurring", description: "Recurring transaction templates" },
      { name: "Receipts", description: "Receipt management and image serving" },
      { name: "Financial", description: "Exchange rates, currency conversion, and market prices" },
      {
        name: "Assets",
        description: "Asset and portfolio tracking (savings, investments, crypto)",
      },
      { name: "Settings", description: "App settings (timezone, etc.)" },
    ],
    paths: {
      "/api/transactions": {
        post: op({
          id: "createTransaction",
          summary: "Create a transaction",
          tags: ["Transactions"],
          body: CreateTransactionSchema,
          response: Transaction,
          status: 201,
          errors: [400, 404, 500],
        }),
        get: op({
          id: "listTransactions",
          summary: "List transactions with filters and pagination",
          tags: ["Transactions"],
          query: ListTransactionsSchema,
          response: PaginatedTransactions,
          errors: [400, 500],
        }),
      },
      "/api/transactions/{id}": {
        get: op({
          id: "getTransactionById",
          summary: "Get a transaction by ID",
          tags: ["Transactions"],
          pathId: "Transaction ID",
          response: Transaction,
          errors: [400, 404, 500],
        }),
        patch: op({
          id: "updateTransaction",
          summary: "Update a transaction",
          tags: ["Transactions"],
          pathId: "Transaction ID",
          body: UpdateTransactionSchema,
          response: Transaction,
          errors: [400, 404, 500],
        }),
        delete: op({
          id: "deleteTransaction",
          summary: "Delete a transaction",
          tags: ["Transactions"],
          pathId: "Transaction ID",
          response: SuccessSchema,
          errors: [400, 404, 500],
        }),
      },
      "/api/categories": {
        post: op({
          id: "createCategory",
          summary: "Create a category",
          tags: ["Categories"],
          body: CreateCategorySchema,
          response: Category,
          status: 201,
          errors: [400, 409, 500],
        }),
        get: op({
          id: "listCategories",
          summary: "List all categories with transaction counts",
          tags: ["Categories"],
          response: z.array(CategoryWithCount),
          errors: [500],
        }),
      },
      "/api/categories/{id}": {
        get: op({
          id: "getCategoryById",
          summary: "Get a category by ID",
          tags: ["Categories"],
          pathId: "Category ID",
          response: Category,
          errors: [400, 404, 500],
        }),
        patch: op({
          id: "updateCategory",
          summary: "Update a category",
          tags: ["Categories"],
          pathId: "Category ID",
          body: UpdateCategorySchema,
          response: Category,
          errors: [400, 404, 409, 500],
        }),
        delete: op({
          id: "deleteCategory",
          summary: "Delete a category",
          tags: ["Categories"],
          pathId: "Category ID",
          response: SuccessSchema,
          errors: [400, 404, 500],
        }),
      },
      "/api/categories/recategorize": {
        post: op({
          id: "recategorize",
          summary: "Bulk-move transactions matching filters to a new category",
          tags: ["Categories"],
          body: RecategorizeSchema,
          response: z.union([
            z.object({ updated: z.number().int() }),
            z.object({ wouldUpdate: z.number().int(), dryRun: z.literal(true) }),
          ]),
          errors: [400, 500],
        }),
      },
      "/api/categories/merge": {
        post: op({
          id: "mergeCategories",
          summary: "Merge source category into target",
          tags: ["Categories"],
          body: MergeCategoriesSchema,
          response: z.object({
            merged: z.literal(true),
            sourceCategoryName: z.string(),
            targetCategoryName: z.string(),
            transactionsMoved: z.number().int(),
            budgetsTransferred: z.number().int(),
          }),
          errors: [400, 500],
        }),
      },
      "/api/reports/summary": {
        get: op({
          id: "spendingSummary",
          summary: "Spending summary grouped by category, month, or merchant",
          tags: ["Reports"],
          query: SpendingSummarySchema,
          response: SummaryResult,
          errors: [400, 500],
        }),
      },
      "/api/reports/category-stats": {
        get: op({
          id: "getCategoryStats",
          summary: "Per-category spending stats with rollups and category metadata",
          tags: ["Reports"],
          query: CategoryStatsSchema,
          response: z.array(CategorySpendingItem),
          errors: [400, 500],
        }),
      },
      "/api/reports/budget-stats": {
        get: op({
          id: "getBudgetStats",
          summary: "Per-category spending stats augmented with budget amounts for a month",
          tags: ["Reports"],
          query: BudgetStatsSchema,
          response: z.array(BudgetStatsItem),
          errors: [400, 500],
        }),
      },
      "/api/reports/trends": {
        get: op({
          id: "trends",
          summary: "Month-over-month spending trends",
          tags: ["Reports"],
          query: TrendsSchema,
          response: z.array(Trend),
          errors: [400, 500],
        }),
      },
      "/api/reports/top-merchants": {
        get: op({
          id: "topMerchants",
          summary: "Top merchants by spend",
          tags: ["Reports"],
          query: TopMerchantsSchema,
          response: z.array(Merchant),
          errors: [400, 500],
        }),
      },
      "/api/budgets": {
        post: op({
          id: "setBudget",
          summary: "Set or update a budget for a category and month",
          tags: ["Budgets"],
          body: SetBudgetSchema,
          response: Budget,
          status: 201,
          errors: [400, 404, 500],
        }),
        get: op({
          id: "getBudgetStatus",
          summary: "Get budget status for all categories in a month",
          tags: ["Budgets"],
          query: GetBudgetStatusSchema,
          response: z.array(BudgetStatus),
          errors: [400, 500],
        }),
        delete: op({
          id: "deleteBudget",
          summary: "Delete a budget for a category and month",
          tags: ["Budgets"],
          query: DeleteBudgetSchema,
          response: SuccessSchema,
          errors: [400, 404, 500],
        }),
      },
      "/api/budgets/reset": {
        post: op({
          id: "resetBudgets",
          summary: "Reset a month's budgets to inherited state by hard-deleting all explicit rows",
          tags: ["Budgets"],
          body: ResetBudgetsSchema,
          response: z.object({ success: z.boolean() }),
          errors: [400, 500],
        }),
      },
      "/api/budgets/history": {
        get: op({
          id: "budgetHistory",
          summary: "Get historical budget vs actual totals across recent months",
          tags: ["Budgets"],
          query: BudgetHistorySchema,
          response: z.array(
            z.object({
              month: z.string(),
              totalBudget: z.number().int(),
              totalSpent: z.number().int(),
              percentUsed: z.number(),
            })
          ),
          errors: [400, 500],
        }),
      },
      "/api/recurring": {
        post: op({
          id: "createRecurring",
          summary: "Create a recurring transaction template",
          tags: ["Recurring"],
          body: CreateRecurringSchema,
          response: Recurring,
          status: 201,
          errors: [400, 404, 500],
        }),
        get: op({
          id: "listRecurring",
          summary: "List all recurring templates with next occurrence",
          tags: ["Recurring"],
          response: z.array(Recurring),
          errors: [500],
        }),
      },
      "/api/recurring/{id}": {
        get: op({
          id: "getRecurringById",
          summary: "Get a recurring template by ID",
          tags: ["Recurring"],
          pathId: "Recurring template ID",
          response: Recurring,
          errors: [400, 404, 500],
        }),
        patch: op({
          id: "updateRecurring",
          summary: "Update a recurring template",
          tags: ["Recurring"],
          pathId: "Recurring template ID",
          body: UpdateRecurringSchema,
          response: Recurring,
          errors: [400, 404, 500],
        }),
        delete: op({
          id: "deleteRecurring",
          summary: "Delete a recurring template",
          tags: ["Recurring"],
          pathId: "Recurring template ID",
          response: SuccessSchema,
          errors: [404, 500],
        }),
      },
      "/api/recurring/generate": {
        post: op({
          id: "generateRecurring",
          summary: "Generate pending recurring transactions up to today",
          tags: ["Recurring"],
          response: z.object({ created: z.number().int() }),
          errors: [500],
        }),
      },
      "/api/receipts": {
        get: op({
          id: "listReceipts",
          summary: "List receipts with optional date/merchant filters, newest first",
          tags: ["Receipts"],
          query: ListReceiptsSchema,
          response: z.object({
            data: z.array(ReceiptRecord),
            total: z.number().int(),
            limit: z.number().int(),
            offset: z.number().int(),
            hasMore: z.boolean(),
          }),
          errors: [400, 500],
        }),
        delete: op({
          id: "batchDeleteReceipts",
          summary: "Batch-delete receipts by IDs (also removes image files from disk)",
          tags: ["Receipts"],
          body: DeleteReceiptsBatchSchema,
          response: z.object({ deleted: z.number().int() }),
          errors: [400, 500],
        }),
      },
      "/api/receipts/upload": {
        post: {
          operationId: "uploadReceipt",
          summary: "Upload a receipt image and optional metadata",
          tags: ["Receipts"],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: z.object({
                  image: z
                    .string()
                    .meta({ description: "Receipt image file (jpg, png, gif, webp, heic, pdf)" }),
                  merchant: z.string().optional().meta({ description: "Merchant name" }),
                  date: z.string().optional().meta({ description: "Receipt date (YYYY-MM-DD)" }),
                  total: z.string().optional().meta({ description: "Receipt total in cents" }),
                  raw_text: z
                    .string()
                    .optional()
                    .meta({ description: "OCR or vision-extracted text" }),
                }),
              },
            },
          },
          responses: {
            "201": {
              description: "Receipt created",
              content: {
                "application/json": { schema: z.object({ receipt_id: z.number().int() }) },
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
        },
      },
      "/api/receipts/{id}": {
        get: op({
          id: "getReceiptById",
          summary: "Get receipt metadata by ID",
          tags: ["Receipts"],
          pathId: "Receipt ID",
          response: ReceiptRecord,
          errors: [400, 404, 500],
        }),
        delete: op({
          id: "deleteReceipt",
          summary: "Delete a receipt and its image file",
          tags: ["Receipts"],
          pathId: "Receipt ID",
          response: SuccessSchema,
          errors: [400, 404, 500],
        }),
      },
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
        },
      },
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
          summary: "Record an asset purchase — creates a transfer transaction + lot",
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
          summary: "Record an asset sale — creates a transfer transaction + negative lot",
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
      "/api/portfolio": {
        get: op({
          id: "getPortfolio",
          summary: "Get net worth, asset allocation, and aggregate P&L",
          tags: ["Assets"],
          response: Portfolio,
          errors: [500],
        }),
      },
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
      "/api/receipts/{id}/image": {
        get: {
          operationId: "getReceiptImage",
          summary: "Serve a receipt image by ID",
          tags: ["Receipts"],
          requestParams: {
            path: z.object({ id: z.string().meta({ description: "Receipt ID" }) }),
          },
          responses: {
            "200": {
              description: "Receipt image file",
              content: {
                "image/jpeg": {
                  schema: z.string().meta({ description: "Binary image data" }),
                },
                "image/png": {
                  schema: z.string().meta({ description: "Binary image data" }),
                },
              },
            },
            "404": {
              description: "Not found",
              content: { "application/json": { schema: ErrorSchema } },
            },
            "500": {
              description: "Internal server error",
              content: { "application/json": { schema: ErrorSchema } },
            },
          },
        },
      },
      "/api/settings/timezone": {
        get: op({
          id: "getTimezone",
          summary: "Get the configured timezone",
          tags: ["Settings"],
          response: z.object({ timezone: z.string().nullable() }),
          errors: [500],
        }),
        put: op({
          id: "setTimezone",
          summary: "Set the app timezone",
          tags: ["Settings"],
          body: z.object({ timezone: z.string() }),
          response: z.object({ timezone: z.string() }),
          errors: [400, 500],
        }),
      },
    },
  });
}
