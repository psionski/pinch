import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CreateRecurringSchema, UpdateRecurringSchema } from "@/lib/validators/recurring";
import { getRecurringService } from "@/lib/api/services";

function ok(data: unknown): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

export function registerRecurringTools(server: McpServer): void {
  server.registerTool(
    "create_recurring",
    {
      description:
        "Create a recurring transaction template. " +
        "frequency: daily | weekly | monthly | yearly. " +
        "dayOfMonth (for monthly) and dayOfWeek (0=Sun, for weekly) are optional; " +
        "if omitted, the day from startDate is used.",
      inputSchema: CreateRecurringSchema,
    },
    (input) => ok(getRecurringService().create(input))
  );

  server.registerTool(
    "get_recurring",
    {
      description: "Get a single recurring transaction template by ID with next occurrence date.",
      inputSchema: z.object({ id: z.number().int().positive() }),
    },
    ({ id }) => {
      const result = getRecurringService().getById(id);
      if (!result) throw new Error(`Recurring template ${id} not found`);
      return ok(result);
    }
  );

  server.registerTool(
    "list_recurring",
    {
      description: "List all recurring transaction templates with next occurrence date and status.",
      inputSchema: z.object({}),
    },
    () => ok(getRecurringService().list())
  );

  server.registerTool(
    "update_recurring",
    {
      description: "Modify a recurring template. Use isActive: false to pause it.",
      inputSchema: z.object({ id: z.number().int().positive(), ...UpdateRecurringSchema.shape }),
    },
    ({ id, ...updates }) => {
      const result = getRecurringService().update(id, updates);
      if (!result) throw new Error(`Recurring template ${id} not found`);
      return ok(result);
    }
  );

  server.registerTool(
    "delete_recurring",
    {
      description:
        "Delete a recurring template. " +
        "Already-generated transactions are kept as normal transaction history.",
      inputSchema: z.object({ id: z.number().int().positive() }),
    },
    ({ id }) => {
      const deleted = getRecurringService().delete(id);
      if (!deleted) throw new Error(`Recurring template ${id} not found`);
      return ok({ deleted: true });
    }
  );

  server.registerTool(
    "generate_pending_recurring",
    {
      description:
        "Manually trigger generation of pending recurring transactions up to today. " +
        "Useful if the server was offline and missed the daily cron job. " +
        "Idempotent — will not create duplicates. Returns the number of transactions created.",
      inputSchema: z.object({}),
    },
    () => {
      const count = getRecurringService().generatePending();
      return ok({ generated: count });
    }
  );
}
