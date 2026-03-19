import { z } from "zod";
import { PaginationSchema, IsoDateSchema } from "./common";

// ─── Response ─────────────────────────────────────────────────────────────────

export const ReceiptResponseSchema = z.object({
  id: z.number().int(),
  merchant: z.string().nullable(),
  date: z.string(),
  total: z.number().int().nullable(),
  imageUrl: z.string().url().nullable(), // absolute URL, e.g. http://localhost:4000/api/receipts/{id}/image — null if no image uploaded
  rawText: z.string().nullable(),
  createdAt: z.string(),
});

export type ReceiptResponse = z.infer<typeof ReceiptResponseSchema>;

// ─── Create (metadata only — image file comes via multipart) ──────────────────

export const CreateReceiptSchema = z.object({
  merchant: z.string().max(255).optional(),
  date: IsoDateSchema.optional(),
  total: z.number().int().min(0).optional(),
  rawText: z.string().max(10000).optional(),
});

export type CreateReceiptInput = z.infer<typeof CreateReceiptSchema>;

// ─── List Unprocessed ─────────────────────────────────────────────────────────

export const ListUnprocessedReceiptsSchema = PaginationSchema;

export type ListUnprocessedReceiptsInput = z.infer<typeof ListUnprocessedReceiptsSchema>;
