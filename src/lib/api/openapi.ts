import { z } from "zod";
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

// ─── OpenAPI metadata (added via .meta() for doc generation only) ────────────

const ErrorSchema = ErrorResponseSchema.meta({ id: "ErrorResponse" });
const SuccessSchema = z.object({ success: z.boolean() }).meta({ id: "SuccessResponse" });

const TransactionSchema = TransactionResponseSchema.meta({ id: "Transaction" });
const PaginatedTransactionsSchema = PaginatedTransactionsResponseSchema.meta({
  id: "PaginatedTransactions",
});
const CategorySchema = CategoryResponseSchema.meta({ id: "Category" });
const CategoryWithCountSchema = CategoryWithCountResponseSchema.meta({
  id: "CategoryWithCount",
});
const BudgetSchema = BudgetResponseSchema.meta({ id: "Budget" });
const BudgetStatusSchema = BudgetStatusItemSchema.meta({ id: "BudgetStatusItem" });
const RecurringSchema = RecurringResponseSchema.meta({ id: "RecurringTemplate" });
const SummaryResultSchema = SpendingSummaryResultSchema.meta({ id: "SpendingSummaryResult" });
const BreakdownItemSchema = CategoryBreakdownItemSchema.meta({ id: "CategoryBreakdownItem" });
const TrendSchema = TrendPointSchema.meta({ id: "TrendPoint" });
const MerchantSchema = TopMerchantSchema.meta({ id: "TopMerchant" });

// ─── Error responses helper ─────────────────────────────────────────────────

function errorResponses(
  ...codes: Array<{ status: string; description: string }>
): Record<
  string,
  { description: string; content: { "application/json": { schema: typeof ErrorSchema } } }
> {
  const result: Record<
    string,
    { description: string; content: { "application/json": { schema: typeof ErrorSchema } } }
  > = {};
  for (const { status, description } of codes) {
    result[status] = {
      description,
      content: { "application/json": { schema: ErrorSchema } },
    };
  }
  return result;
}

const err400 = { status: "400", description: "Validation error" };
const err404 = { status: "404", description: "Not found" };
const err409 = { status: "409", description: "Conflict" };
const err500 = { status: "500", description: "Internal server error" };

// ─── Path operations ─────────────────────────────────────────────────────────

const postTransaction: ZodOpenApiOperationObject = {
  operationId: "createTransaction",
  summary: "Create a transaction",
  tags: ["Transactions"],
  requestBody: {
    required: true,
    content: { "application/json": { schema: CreateTransactionSchema } },
  },
  responses: {
    "201": {
      description: "Transaction created",
      content: { "application/json": { schema: TransactionSchema } },
    },
    ...errorResponses(err400, err404, err500),
  },
};

const getTransactions: ZodOpenApiOperationObject = {
  operationId: "listTransactions",
  summary: "List transactions with filters and pagination",
  tags: ["Transactions"],
  requestParams: { query: ListTransactionsSchema },
  responses: {
    "200": {
      description: "Paginated transaction list",
      content: { "application/json": { schema: PaginatedTransactionsSchema } },
    },
    ...errorResponses(err400, err500),
  },
};

const getTransactionById: ZodOpenApiOperationObject = {
  operationId: "getTransactionById",
  summary: "Get a transaction by ID",
  tags: ["Transactions"],
  requestParams: {
    path: z.object({ id: z.string().meta({ description: "Transaction ID" }) }),
  },
  responses: {
    "200": {
      description: "Transaction details",
      content: { "application/json": { schema: TransactionSchema } },
    },
    ...errorResponses(err400, err404, err500),
  },
};

const patchTransaction: ZodOpenApiOperationObject = {
  operationId: "updateTransaction",
  summary: "Update a transaction",
  tags: ["Transactions"],
  requestParams: {
    path: z.object({ id: z.string().meta({ description: "Transaction ID" }) }),
  },
  requestBody: {
    required: true,
    content: { "application/json": { schema: UpdateTransactionSchema } },
  },
  responses: {
    "200": {
      description: "Updated transaction",
      content: { "application/json": { schema: TransactionSchema } },
    },
    ...errorResponses(err400, err404, err500),
  },
};

const deleteTransaction: ZodOpenApiOperationObject = {
  operationId: "deleteTransaction",
  summary: "Delete a transaction",
  tags: ["Transactions"],
  requestParams: {
    path: z.object({ id: z.string().meta({ description: "Transaction ID" }) }),
  },
  responses: {
    "200": {
      description: "Deleted successfully",
      content: { "application/json": { schema: SuccessSchema } },
    },
    ...errorResponses(err400, err404, err500),
  },
};

const postCategory: ZodOpenApiOperationObject = {
  operationId: "createCategory",
  summary: "Create a category",
  tags: ["Categories"],
  requestBody: {
    required: true,
    content: { "application/json": { schema: CreateCategorySchema } },
  },
  responses: {
    "201": {
      description: "Category created",
      content: { "application/json": { schema: CategorySchema } },
    },
    ...errorResponses(err400, err409, err500),
  },
};

const getCategories: ZodOpenApiOperationObject = {
  operationId: "listCategories",
  summary: "List all categories with transaction counts",
  tags: ["Categories"],
  responses: {
    "200": {
      description: "List of categories",
      content: { "application/json": { schema: z.array(CategoryWithCountSchema) } },
    },
    ...errorResponses(err500),
  },
};

const getCategoryById: ZodOpenApiOperationObject = {
  operationId: "getCategoryById",
  summary: "Get a category by ID",
  tags: ["Categories"],
  requestParams: {
    path: z.object({ id: z.string().meta({ description: "Category ID" }) }),
  },
  responses: {
    "200": {
      description: "Category details",
      content: { "application/json": { schema: CategorySchema } },
    },
    ...errorResponses(err400, err404, err500),
  },
};

const patchCategory: ZodOpenApiOperationObject = {
  operationId: "updateCategory",
  summary: "Update a category",
  tags: ["Categories"],
  requestParams: {
    path: z.object({ id: z.string().meta({ description: "Category ID" }) }),
  },
  requestBody: {
    required: true,
    content: { "application/json": { schema: UpdateCategorySchema } },
  },
  responses: {
    "200": {
      description: "Updated category",
      content: { "application/json": { schema: CategorySchema } },
    },
    ...errorResponses(err400, err404, err409, err500),
  },
};

const deleteCategory: ZodOpenApiOperationObject = {
  operationId: "deleteCategory",
  summary: "Delete a category",
  tags: ["Categories"],
  requestParams: {
    path: z.object({ id: z.string().meta({ description: "Category ID" }) }),
  },
  responses: {
    "200": {
      description: "Deleted successfully",
      content: { "application/json": { schema: SuccessSchema } },
    },
    ...errorResponses(err400, err404, err500),
  },
};

const postRecategorize: ZodOpenApiOperationObject = {
  operationId: "recategorize",
  summary: "Bulk-move transactions matching filters to a new category",
  tags: ["Categories"],
  requestBody: {
    required: true,
    content: { "application/json": { schema: RecategorizeSchema } },
  },
  responses: {
    "200": {
      description: "Number of transactions updated",
      content: { "application/json": { schema: z.object({ updated: z.number().int() }) } },
    },
    ...errorResponses(err400, err500),
  },
};

const postMerge: ZodOpenApiOperationObject = {
  operationId: "mergeCategories",
  summary: "Merge source category into target (moves transactions, deletes source)",
  tags: ["Categories"],
  requestBody: {
    required: true,
    content: { "application/json": { schema: MergeCategoriesSchema } },
  },
  responses: {
    "200": {
      description: "Merged successfully",
      content: { "application/json": { schema: SuccessSchema } },
    },
    ...errorResponses(err400, err500),
  },
};

const getSummary: ZodOpenApiOperationObject = {
  operationId: "spendingSummary",
  summary: "Spending summary grouped by category, month, or merchant",
  tags: ["Reports"],
  requestParams: { query: SpendingSummarySchema },
  responses: {
    "200": {
      description: "Spending summary with optional comparison period",
      content: { "application/json": { schema: SummaryResultSchema } },
    },
    ...errorResponses(err400, err500),
  },
};

const getBreakdown: ZodOpenApiOperationObject = {
  operationId: "categoryBreakdown",
  summary: "Category breakdown with amounts and percentages",
  tags: ["Reports"],
  requestParams: { query: CategoryBreakdownSchema },
  responses: {
    "200": {
      description: "Category breakdown",
      content: { "application/json": { schema: z.array(BreakdownItemSchema) } },
    },
    ...errorResponses(err400, err500),
  },
};

const getTrends: ZodOpenApiOperationObject = {
  operationId: "trends",
  summary: "Month-over-month spending trends",
  tags: ["Reports"],
  requestParams: { query: TrendsSchema },
  responses: {
    "200": {
      description: "Monthly trend points",
      content: { "application/json": { schema: z.array(TrendSchema) } },
    },
    ...errorResponses(err400, err500),
  },
};

const getTopMerchants: ZodOpenApiOperationObject = {
  operationId: "topMerchants",
  summary: "Top merchants by spend",
  tags: ["Reports"],
  requestParams: { query: TopMerchantsSchema },
  responses: {
    "200": {
      description: "Top merchants list",
      content: { "application/json": { schema: z.array(MerchantSchema) } },
    },
    ...errorResponses(err400, err500),
  },
};

const postBudget: ZodOpenApiOperationObject = {
  operationId: "setBudget",
  summary: "Set or update a budget for a category and month",
  tags: ["Budgets"],
  requestBody: {
    required: true,
    content: { "application/json": { schema: SetBudgetSchema } },
  },
  responses: {
    "201": {
      description: "Budget created/updated",
      content: { "application/json": { schema: BudgetSchema } },
    },
    ...errorResponses(err400, err404, err500),
  },
};

const getBudgetStatus: ZodOpenApiOperationObject = {
  operationId: "getBudgetStatus",
  summary: "Get budget status (spend vs budget) for all categories in a month",
  tags: ["Budgets"],
  requestParams: { query: GetBudgetStatusSchema },
  responses: {
    "200": {
      description: "Budget status for each category",
      content: { "application/json": { schema: z.array(BudgetStatusSchema) } },
    },
    ...errorResponses(err400, err500),
  },
};

const postRecurring: ZodOpenApiOperationObject = {
  operationId: "createRecurring",
  summary: "Create a recurring transaction template",
  tags: ["Recurring"],
  requestBody: {
    required: true,
    content: { "application/json": { schema: CreateRecurringSchema } },
  },
  responses: {
    "201": {
      description: "Recurring template created",
      content: { "application/json": { schema: RecurringSchema } },
    },
    ...errorResponses(err400, err404, err500),
  },
};

const getRecurring: ZodOpenApiOperationObject = {
  operationId: "listRecurring",
  summary: "List all recurring templates with next occurrence",
  tags: ["Recurring"],
  responses: {
    "200": {
      description: "List of recurring templates",
      content: { "application/json": { schema: z.array(RecurringSchema) } },
    },
    ...errorResponses(err500),
  },
};

const getRecurringById: ZodOpenApiOperationObject = {
  operationId: "getRecurringById",
  summary: "Get a recurring template by ID",
  tags: ["Recurring"],
  requestParams: {
    path: z.object({ id: z.string().meta({ description: "Recurring template ID" }) }),
  },
  responses: {
    "200": {
      description: "Recurring template details",
      content: { "application/json": { schema: RecurringSchema } },
    },
    ...errorResponses(err400, err404, err500),
  },
};

const patchRecurring: ZodOpenApiOperationObject = {
  operationId: "updateRecurring",
  summary: "Update a recurring template",
  tags: ["Recurring"],
  requestParams: {
    path: z.object({ id: z.string().meta({ description: "Recurring template ID" }) }),
  },
  requestBody: {
    required: true,
    content: { "application/json": { schema: UpdateRecurringSchema } },
  },
  responses: {
    "200": {
      description: "Updated recurring template",
      content: { "application/json": { schema: RecurringSchema } },
    },
    ...errorResponses(err400, err404, err500),
  },
};

const deleteRecurring: ZodOpenApiOperationObject = {
  operationId: "deleteRecurring",
  summary: "Delete a recurring template",
  tags: ["Recurring"],
  requestParams: {
    path: z.object({ id: z.string().meta({ description: "Recurring template ID" }) }),
  },
  requestBody: {
    content: { "application/json": { schema: DeleteRecurringSchema } },
  },
  responses: {
    "200": {
      description: "Deleted successfully",
      content: { "application/json": { schema: SuccessSchema } },
    },
    ...errorResponses(err400, err404, err500),
  },
};

const postGenerate: ZodOpenApiOperationObject = {
  operationId: "generateRecurring",
  summary: "Generate pending recurring transactions up to a date",
  tags: ["Recurring"],
  requestBody: {
    required: true,
    content: { "application/json": { schema: GenerateRecurringSchema } },
  },
  responses: {
    "200": {
      description: "Number of transactions created",
      content: { "application/json": { schema: z.object({ created: z.number().int() }) } },
    },
    ...errorResponses(err400, err500),
  },
};

const getReceiptImage: ZodOpenApiOperationObject = {
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
        "image/jpeg": { schema: z.string().meta({ description: "Binary image data" }) },
        "image/png": { schema: z.string().meta({ description: "Binary image data" }) },
      },
    },
    ...errorResponses(err404, err500),
  },
};

// ─── Document generation ─────────────────────────────────────────────────────

export function generateOpenApiDocument(): ReturnType<typeof createDocument> {
  return createDocument({
    openapi: "3.1.0",
    info: {
      title: "Pinch API",
      version: "1.0.0",
      description:
        "Personal finance tracker API. All monetary amounts are integers in cents (e.g. 1210 = €12.10).",
    },
    servers: [{ url: "/", description: "Current server" }],
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
        post: postTransaction,
        get: getTransactions,
      },
      "/api/transactions/{id}": {
        get: getTransactionById,
        patch: patchTransaction,
        delete: deleteTransaction,
      },
      "/api/categories": {
        post: postCategory,
        get: getCategories,
      },
      "/api/categories/{id}": {
        get: getCategoryById,
        patch: patchCategory,
        delete: deleteCategory,
      },
      "/api/categories/recategorize": {
        post: postRecategorize,
      },
      "/api/categories/merge": {
        post: postMerge,
      },
      "/api/reports/summary": {
        get: getSummary,
      },
      "/api/reports/breakdown": {
        get: getBreakdown,
      },
      "/api/reports/trends": {
        get: getTrends,
      },
      "/api/reports/top-merchants": {
        get: getTopMerchants,
      },
      "/api/budgets": {
        post: postBudget,
        get: getBudgetStatus,
      },
      "/api/recurring": {
        post: postRecurring,
        get: getRecurring,
      },
      "/api/recurring/{id}": {
        get: getRecurringById,
        patch: patchRecurring,
        delete: deleteRecurring,
      },
      "/api/recurring/generate": {
        post: postGenerate,
      },
      "/api/receipts/{id}/image": {
        get: getReceiptImage,
      },
    },
  });
}
