import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { clearSampleData } from "@/lib/services/sample-data";
import { ok, err } from "@/lib/mcp/response";

export function registerSampleDataTools(server: McpServer): void {
  server.registerTool(
    "clear_sample_data",
    {
      description:
        "Clear sample/seed data from the app. " +
        "Only works when the database is flagged as containing sample data — " +
        "refuses to run on a real account to prevent accidental data loss. " +
        "After clearing, the database is empty and ready for real data — " +
        "the user will need to reconfigure their timezone.",
      inputSchema: {},
    },
    () => {
      try {
        clearSampleData();
        return ok({ cleared: true });
      } catch (e) {
        return err(e instanceof Error ? e.message : "Failed to clear sample data");
      }
    }
  );
}
