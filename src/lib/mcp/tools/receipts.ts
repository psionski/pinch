import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getReceiptService } from "@/lib/api/services";
import { ListReceiptsSchema } from "@/lib/validators/receipts";
import { IdSchema, PaginationSchema } from "@/lib/validators/common";
import { ok } from "@/lib/mcp/response";

export function registerReceiptTools(server: McpServer): void {
  server.registerTool(
    "get_receipt",
    {
      description:
        "Get a single receipt by ID. Returns metadata (merchant, date, total, rawText) and " +
        "an imageUrl (absolute URL, ready to fetch) to view the uploaded image.",
      inputSchema: IdSchema,
    },
    ({ id }) => {
      const receipt = getReceiptService().getById(id);
      if (!receipt) throw new Error(`Receipt ${id} not found`);
      return ok(receipt);
    }
  );

  server.registerTool(
    "list_receipts",
    {
      description:
        "List receipts with optional filters, newest first. Filter by date range " +
        "(dateFrom/dateTo) and/or merchant substring. Returns full receipt details " +
        "including imageUrl. Useful for browsing receipts or finding old ones to clean up.",
      inputSchema: ListReceiptsSchema,
    },
    (input) => ok(getReceiptService().list(input))
  );

  server.registerTool(
    "list_unprocessed_receipts",
    {
      description:
        "List receipts that have no linked transactions yet — useful for proactively finding and " +
        "categorizing newly uploaded receipts. Returns full receipt details including imageUrl (absolute URL, ready to fetch).",
      inputSchema: PaginationSchema,
    },
    (input) => ok(getReceiptService().listUnprocessed(input))
  );

  server.registerTool(
    "delete_receipt",
    {
      description: "Delete one or more receipts and their images. Linked transactions are kept.",
      inputSchema: z.object({
        id: z
          .union([
            z.number().int().positive(),
            z.array(z.number().int().positive()).min(1).max(200),
          ])
          .describe("Single receipt ID or array of IDs"),
      }),
    },
    ({ id }) => {
      const svc = getReceiptService();
      if (Array.isArray(id)) {
        const count = svc.batchDelete(id);
        return ok({ deleted: count });
      }
      const deleted = svc.delete(id);
      if (!deleted) throw new Error(`Receipt ${id} not found`);
      return ok({ deleted: 1 });
    }
  );
}
