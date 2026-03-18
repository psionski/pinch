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
  CategoryStatsSchema,
} from "@/lib/validators/categories";
import {
  SetBudgetSchema,
  GetBudgetStatusSchema,
  BudgetResponseSchema,
} from "@/lib/validators/budgets";
import {
  CreateRecurringSchema,
  UpdateRecurringSchema,
  GenerateRecurringSchema,
  DeleteRecurringSchema,
  RecurringResponseSchema,
} from "@/lib/validators/recurring";
import {
  SpendingSummarySchema,
  CategoryBreakdownSchema,
  TrendsSchema,
  TopMerchantsSchema,
  SpendingSummaryResultSchema,
  CategoryBreakdownItemSchema,
  TrendPointSchema,
  TopMerchantSchema,
  BudgetStatusItemSchema,
} from "@/lib/validators/reports";
import { ErrorResponseSchema } from "@/lib/validators/common";

// ─── Named component schemas ────────────────────────────────────────────────

const ErrorSchema = ErrorResponseSchema.meta({ id: "ErrorResponse" });
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
const SummaryResult = SpendingSummaryResultSchema.meta({ id: "SpendingSummaryResult" });
const BreakdownItem = CategoryBreakdownItemSchema.meta({ id: "CategoryBreakdownItem" });
const Trend = TrendPointSchema.meta({ id: "TrendPoint" });
const Merchant = TopMerchantSchema.meta({ id: "TopMerchant" });
const CategoryStatsItem = CategoryStatsSchema.meta({ id: "CategoryStats" });

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
      { name: "Receipts", description: "Receipt image serving" },
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
          response: z.object({ updated: z.number().int() }),
          errors: [400, 500],
        }),
      },
      "/api/categories/merge": {
        post: op({
          id: "mergeCategories",
          summary: "Merge source category into target",
          tags: ["Categories"],
          body: MergeCategoriesSchema,
          response: SuccessSchema,
          errors: [400, 500],
        }),
      },
      "/api/categories/stats": {
        get: op({
          id: "getCategoryStats",
          summary: "Get per-category spend, transaction count, and budget for a month",
          tags: ["Categories"],
          query: z.object({ month: z.string().meta({ description: "Month in YYYY-MM format" }) }),
          response: z.array(CategoryStatsItem),
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
      "/api/reports/breakdown": {
        get: op({
          id: "categoryBreakdown",
          summary: "Category breakdown with amounts and percentages",
          tags: ["Reports"],
          query: CategoryBreakdownSchema,
          response: z.array(BreakdownItem),
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
          body: DeleteRecurringSchema,
          response: SuccessSchema,
          errors: [400, 404, 500],
        }),
      },
      "/api/recurring/generate": {
        post: op({
          id: "generateRecurring",
          summary: "Generate pending recurring transactions up to a date",
          tags: ["Recurring"],
          body: GenerateRecurringSchema,
          response: z.object({ created: z.number().int() }),
          errors: [400, 500],
        }),
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
    },
  });
}
