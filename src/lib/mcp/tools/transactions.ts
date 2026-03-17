import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CreateTransactionSchema,
  CreateTransactionsBatchSchema,
  UpdateTransactionSchema,
  ListTransactionsSchema,
} from "@/lib/validators/transactions";
import { getTransactionService } from "@/lib/api/services";

function ok(data: unknown): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

export function registerTransactionTools(server: McpServer): void {
  server.registerTool(
    "add_transaction",
    {
      description:
        "Add a single transaction. Amounts are in cents (e.g. 1210 = €12.10). " +
        "type defaults to 'expense'. date must be YYYY-MM-DD.",
      inputSchema: CreateTransactionSchema,
    },
    (input) => ok(getTransactionService().create(input))
  );

  server.registerTool(
    "add_transactions",
    {
      description:
        "Batch-add multiple transactions in one call. Optionally link all of them " +
        "to an uploaded receipt via receipt_id (see server instructions for the upload flow).",
      inputSchema: CreateTransactionsBatchSchema,
    },
    (input) => ok(getTransactionService().createBatch(input))
  );

  server.registerTool(
    "update_transaction",
    {
      description:
        "Update fields on an existing transaction by ID. Only supplied fields are changed.",
      inputSchema: z.object({ id: z.number().int().positive(), ...UpdateTransactionSchema.shape }),
    },
    ({ id, ...updates }) => {
      const svc = getTransactionService();
      const result = svc.update(id, updates);
      if (!result) throw new Error(`Transaction ${id} not found`);
      return ok(result);
    }
  );

  server.registerTool(
    "delete_transaction",
    {
      description:
        "Delete one or more transactions. Pass a single id or an array of ids for bulk delete.",
      inputSchema: z.object({
        id: z
          .union([
            z.number().int().positive(),
            z.array(z.number().int().positive()).min(1).max(200),
          ])
          .describe("Single transaction ID or array of IDs"),
      }),
    },
    ({ id }) => {
      const svc = getTransactionService();
      if (Array.isArray(id)) {
        const count = svc.deleteBatch(id);
        return ok({ deleted: count });
      }
      const deleted = svc.delete(id);
      if (!deleted) throw new Error(`Transaction ${id} not found`);
      return ok({ deleted: 1 });
    }
  );

  server.registerTool(
    "list_transactions",
    {
      description:
        "List transactions with optional filters: date range, category, amount range, " +
        "merchant, full-text search, tags, type. Sorted by date desc by default.",
      inputSchema: ListTransactionsSchema,
    },
    (input) => ok(getTransactionService().list(input))
  );

  server.registerTool(
    "list_tags",
    {
      description: "List all distinct tags used across transactions, sorted alphabetically.",
      inputSchema: z.object({}),
    },
    () => ok(getTransactionService().listTags())
  );
}
