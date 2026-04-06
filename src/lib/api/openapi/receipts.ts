import { z } from "zod";
import type { ZodOpenApiOperationObject } from "zod-openapi";
import {
  ReceiptResponseSchema,
  ListReceiptsSchema,
  DeleteReceiptsBatchSchema,
} from "@/lib/validators/receipts";
import { op, SuccessSchema, ErrorSchema } from "./helpers";

const ReceiptRecord = ReceiptResponseSchema.meta({ id: "Receipt" });

export const receiptPaths = {
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
              total: z.string().optional().meta({ description: "Receipt total amount" }),
              raw_text: z.string().optional().meta({ description: "OCR or vision-extracted text" }),
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
    } satisfies ZodOpenApiOperationObject,
  },
};
