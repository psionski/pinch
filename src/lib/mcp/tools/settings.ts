import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SetTimezoneSchema } from "@/lib/validators/settings";
import { getSettingsService } from "@/lib/api/services";
import { setUserTimezone } from "@/lib/date-ranges";
import { ok } from "@/lib/mcp/response";

export function registerSettingsTools(server: McpServer): void {
  server.registerTool(
    "get_timezone",
    {
      description:
        "Get the user's configured timezone. Returns null if not yet configured. " +
        "A null value means the app has not been set up — ask the user for their timezone " +
        "and call set_timezone before proceeding.",
      inputSchema: {},
    },
    () => {
      const timezone = getSettingsService().getTimezone();
      return ok({ timezone });
    }
  );

  server.registerTool(
    "set_timezone",
    {
      description:
        "Set the user's timezone. Affects how 'today' and 'this month' are computed throughout the app.",
      inputSchema: SetTimezoneSchema,
    },
    (input) => {
      getSettingsService().setTimezone(input.timezone);
      setUserTimezone(input.timezone);
      return ok({ timezone: input.timezone });
    }
  );
}
