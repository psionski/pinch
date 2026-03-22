import { z } from "zod";
import { IsoDateSchema } from "./common";

// ─── Response ────────────────────────────────────────────────────────────────

export const CategoryResponseSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  parentId: z.number().int().nullable(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CategoryResponse = z.infer<typeof CategoryResponseSchema>;

export const CategoryWithCountResponseSchema = CategoryResponseSchema.extend({
  transactionCount: z.number().int(),
});

export type CategoryWithCountResponse = z.infer<typeof CategoryWithCountResponseSchema>;

// Hex color: #RRGGBB or #RGB
const HexColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Must be a valid hex color (e.g. #FF5733)");

// ─── Create ───────────────────────────────────────────────────────────────────

export const CreateCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  parentId: z.number().int().positive().nullable().optional(),
  icon: z.string().max(50).optional(),
  color: HexColorSchema.optional(),
});

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

// ─── Update ───────────────────────────────────────────────────────────────────

export const UpdateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parentId: z.number().int().positive().nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  color: HexColorSchema.nullable().optional(),
});

export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;

// ─── Recategorize ─────────────────────────────────────────────────────────────
// Bulk-move transactions matching a filter to a new category

export const RecategorizeSchema = z
  .object({
    targetCategoryId: z.number().int().positive("Target category ID is required"),
    sourceCategoryId: z.number().int().positive().optional(),
    merchantPattern: z.string().max(255).optional(),
    descriptionPattern: z.string().max(255).optional(),
    dateFrom: IsoDateSchema.optional(),
    dateTo: IsoDateSchema.optional(),
    dryRun: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.sourceCategoryId !== undefined ||
      data.merchantPattern !== undefined ||
      data.descriptionPattern !== undefined ||
      data.dateFrom !== undefined ||
      data.dateTo !== undefined,
    {
      message:
        "At least one filter (sourceCategoryId, merchantPattern, descriptionPattern, dateFrom, dateTo) is required",
    }
  );

export type RecategorizeInput = z.infer<typeof RecategorizeSchema>;

// ─── Merge ────────────────────────────────────────────────────────────────────
// Move all transactions from source → target, delete source

export const MergeCategoriesSchema = z
  .object({
    sourceCategoryId: z.number().int().positive("Source category ID is required"),
    targetCategoryId: z.number().int().positive("Target category ID is required"),
  })
  .refine((data) => data.sourceCategoryId !== data.targetCategoryId, {
    message: "Source and target category must be different",
  });

export type MergeCategoriesInput = z.infer<typeof MergeCategoriesSchema>;
