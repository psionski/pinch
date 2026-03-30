import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CreateTransactionSchema,
  CreateTransactionsBatchSchema,
  UpdateTransactionSchema,
  UpdateTransactionsBatchSchema,
  ListTransactionsSchema,
} from "@/lib/validators/transactions";
import { IdSchema } from "@/lib/validators/common";
import { getTransactionService } from "@/lib/api/services";
import { ok } from "@/lib/mcp/response";

export function registerTransactionTools(server: McpServer): void {
  server.registerTool(
    "create_transaction",
    {
      description:
        "Add a single transaction. Use list_categories to find valid categoryId values. " +
        "When someone sends the user money to a specific asset (e.g. 'Alice sent me 50 EUR to Revolut'), " +
        "use create_transactions to batch-add an income transaction and a transfer transaction " +
        "as per the create_transactions tool description. " +
        "Transfer amounts are signed: negative = cash out (asset purchase), positive = cash in (asset sale).",
      inputSchema: CreateTransactionSchema,
    },
    (input) => ok(getTransactionService().create(input))
  );

  server.registerTool(
    "create_transactions",
    {
      description:
        "Batch-add multiple transactions in one call. " +
        "Use list_categories to find valid categoryId values. " +
        "Optionally link all to an uploaded receipt via receiptId. " +
        "When someone sends the user money to a specific asset (e.g. 'Alice sent me 50 EUR to Revolut'), " +
        "create two transactions in the batch: (1) an income transaction for the amount, and " +
        "(2) a transfer transaction moving the funds into the destination asset.",
      inputSchema: CreateTransactionsBatchSchema,
    },
    (input) => ok(getTransactionService().createBatch(input))
  );

  server.registerTool(
    "update_transaction",
    {
      description:
        "Update fields on an existing transaction by ID. Only supplied fields are changed.",
      inputSchema: IdSchema.merge(UpdateTransactionSchema),
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
    "get_transaction",
    {
      description: "Get a single transaction by ID with all fields.",
      inputSchema: IdSchema,
    },
    ({ id }) => {
      const result = getTransactionService().getById(id);
      if (!result) throw new Error(`Transaction ${id} not found`);
      return ok(result);
    }
  );

  server.registerTool(
    "list_transactions",
    {
      description:
        "List transactions with optional filters: date range, category, amount range, " +
        "merchant, full-text search, tags, type. Sorted by date desc by default. " +
        "Pass categoryId: null to filter for uncategorized transactions only.",
      inputSchema: ListTransactionsSchema,
    },
    (input) => ok(getTransactionService().list(input))
  );

  server.registerTool(
    "batch_update_transactions",
    {
      description:
        "Update multiple transactions in one call. Each entry must have an id plus any fields to change. " +
        "Silently skips IDs that don't exist. Returns the updated transactions.",
      inputSchema: UpdateTransactionsBatchSchema,
    },
    (input) => ok(getTransactionService().updateBatch(input))
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
