import { z } from "zod";

// ─── Shared Primitives ───────────────────────────────────────────────────────

/** ISO 8601 date string: YYYY-MM-DD */
export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

/** YYYY-MM month format */
export const YearMonthSchema = z.string().regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format");

export const TransactionTypeSchema = z.enum(["income", "expense", "transfer"]);

export const FrequencySchema = z.enum(["daily", "weekly", "monthly", "yearly"]);

// ─── Pagination ───────────────────────────────────────────────────────────────

export const PaginationSchema = z.object({
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

export type PaginationParams = z.infer<typeof PaginationSchema>;

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ─── Error Envelope ───────────────────────────────────────────────────────────

export const ErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "CONFLICT",
  "INTERNAL_ERROR",
]);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: ErrorCodeSchema,
  details: z.unknown().optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
