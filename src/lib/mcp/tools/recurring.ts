import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  CreateRecurringSchema,
  UpdateRecurringSchema,
  DeleteRecurringSchema,
  GenerateRecurringSchema,
} from "@/lib/validators/recurring";
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
        "Set deleteFutureTransactions to true to also delete generated transactions " +
        "whose date is after today.",
      inputSchema: z.object({ id: z.number().int().positive(), ...DeleteRecurringSchema.shape }),
    },
    ({ id, ...options }) => {
      const deleted = getRecurringService().delete(id, options);
      if (!deleted) throw new Error(`Recurring template ${id} not found`);
      return ok({ deleted: true });
    }
  );

  server.registerTool(
    "generate_recurring",
    {
      description:
        "Manually trigger generation of pending recurring transactions up to a given date. " +
        "Returns the number of transactions created.",
      inputSchema: GenerateRecurringSchema,
    },
    (input) => {
      const count = getRecurringService().generatePending(input);
      return ok({ generated: count });
    }
  );
}
