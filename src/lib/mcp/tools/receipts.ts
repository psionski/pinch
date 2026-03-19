import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getReceiptService } from "@/lib/api/services";
import { PaginationSchema } from "@/lib/validators/common";

function ok(data: unknown): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

export function registerReceiptTools(server: McpServer): void {
  server.registerTool(
    "get_receipt",
    {
      description:
        "Get a single receipt by ID. Returns metadata (merchant, date, total, rawText) and " +
        "an imageUrl (absolute URL, ready to fetch) to view the uploaded image.",
      inputSchema: z.object({ id: z.number().int().positive() }),
    },
    ({ id }) => {
      const receipt = getReceiptService().getById(id);
      if (!receipt) throw new Error(`Receipt ${id} not found`);
      return ok(receipt);
    }
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
}
