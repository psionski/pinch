import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  RecategorizeSchema,
  MergeCategoriesSchema,
} from "@/lib/validators/categories";
import { getCategoryService } from "@/lib/api/services";

function ok(data: unknown): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

export function registerCategoryTools(server: McpServer): void {
  server.registerTool(
    "list_categories",
    {
      description:
        "List all categories with hierarchy (parent_id), transaction counts, and metadata.",
      inputSchema: z.object({}),
    },
    () => ok(getCategoryService().getAll())
  );

  server.registerTool(
    "create_category",
    {
      description: "Create a new category. Optionally set a parent_id for subcategories.",
      inputSchema: CreateCategorySchema,
    },
    (input) => ok(getCategoryService().create(input))
  );

  server.registerTool(
    "update_category",
    {
      description: "Rename, reparent, or change icon/color of a category.",
      inputSchema: z.object({ id: z.number().int().positive(), ...UpdateCategorySchema.shape }),
    },
    ({ id, ...updates }) => {
      const result = getCategoryService().update(id, updates);
      if (!result) throw new Error(`Category ${id} not found`);
      return ok(result);
    }
  );

  server.registerTool(
    "recategorize",
    {
      description:
        "Bulk-move transactions matching a filter to a new category. " +
        "At least one of: sourceCategoryId, merchantPattern, descriptionPattern, dateFrom, dateTo is required.",
      inputSchema: RecategorizeSchema,
    },
    (input) => {
      const count = getCategoryService().recategorize(input);
      return ok({ updated: count });
    }
  );

  server.registerTool(
    "merge_categories",
    {
      description:
        "Merge source category into target: all transactions are reassigned to target, " +
        "non-conflicting budgets are transferred, and the source category is deleted.",
      inputSchema: MergeCategoriesSchema,
    },
    (input) => {
      getCategoryService().merge(input);
      return ok({ merged: true });
    }
  );
}
