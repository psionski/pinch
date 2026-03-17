import { z } from "zod";

// Hex color: #RRGGBB or #RGB
const HexColorSchema = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Must be a valid hex color (e.g. #FF5733)");

// ISO 8601 date string: YYYY-MM-DD
const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

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

export const RecategorizeSchema = z.object({
  targetCategoryId: z.number().int().positive("Target category ID is required"),
  sourceCategoryId: z.number().int().positive().optional(),
  merchantPattern: z.string().max(255).optional(),
  descriptionPattern: z.string().max(255).optional(),
  dateFrom: IsoDateSchema.optional(),
  dateTo: IsoDateSchema.optional(),
});

export type RecategorizeInput = z.infer<typeof RecategorizeSchema>;

// ─── Merge ────────────────────────────────────────────────────────────────────
// Move all transactions from source → target, delete source

export const MergeCategoriesSchema = z.object({
  sourceCategoryId: z.number().int().positive("Source category ID is required"),
  targetCategoryId: z.number().int().positive("Target category ID is required"),
});

export type MergeCategoriesInput = z.infer<typeof MergeCategoriesSchema>;
