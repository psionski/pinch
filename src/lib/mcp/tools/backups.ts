import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RestoreBackupSchema } from "@/lib/validators/backups";
import { runBackup, listBackups, restoreBackup } from "@/lib/services/backup";

const DB_PATH = process.env.DATABASE_URL ?? "./data/pinch.db";

function ok(data: unknown): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

export function registerBackupTools(server: McpServer): void {
  server.registerTool(
    "create_backup",
    {
      description:
        "Create a manual backup of the database. Returns the backup filename and how many " +
        "old backups were rotated out (max 7 kept).",
      inputSchema: {},
    },
    async () => {
      const result = await runBackup(DB_PATH);
      const filename = result.path.split(/[\\/]/).pop();
      return ok({ filename, rotatedCount: result.rotatedCount });
    }
  );

  server.registerTool(
    "list_backups",
    {
      description:
        "List all available database backups. Returns filenames, sizes, and creation " +
        "timestamps in the user's local timezone. Sorted newest-first.",
      inputSchema: {},
    },
    () => {
      return ok(listBackups());
    }
  );

  server.registerTool(
    "restore_backup",
    {
      description:
        "Restore the database from a backup file. A safety backup of the current database " +
        "is created before restoring. The DB connection is automatically reset so changes " +
        "take effect immediately. Use list_backups to see available backups first.",
      inputSchema: RestoreBackupSchema,
    },
    async (input) => {
      const result = await restoreBackup(DB_PATH, input.filename);
      return ok(result);
    }
  );
}
