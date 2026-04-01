import { z } from "zod";
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  RecategorizeSchema,
  MergeCategoriesSchema,
  CategoryResponseSchema,
  CategoryWithCountResponseSchema,
} from "@/lib/validators/categories";
import { op, SuccessSchema } from "./helpers";

const Category = CategoryResponseSchema.meta({ id: "Category" });
const CategoryWithCount = CategoryWithCountResponseSchema.meta({ id: "CategoryWithCount" });

export const categoryPaths = {
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
};
