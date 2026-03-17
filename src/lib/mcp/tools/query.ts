import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type Database from "better-sqlite3";
import { getDb } from "@/lib/db";

function ok(data: unknown): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

/** Rough check that a SQL statement is read-only. */
function isReadOnly(sqlStr: string): boolean {
  const normalized = sqlStr.trim().toUpperCase();
  return normalized.startsWith("SELECT") || normalized.startsWith("WITH");
}

export function registerQueryTool(server: McpServer): void {
  server.registerTool(
    "query",
    {
      description:
        "Execute a read-only SQL query against the database. " +
        "Only SELECT and WITH (CTE) statements are allowed. " +
        "Use for ad-hoc analysis: window functions, date math, cross-table joins, " +
        "custom aggregations — anything the pre-built tools don't cover.",
      inputSchema: z.object({
        sql: z.string().min(1).max(4000).describe("Read-only SQL statement (SELECT or WITH)"),
      }),
    },
    ({ sql }) => {
      if (!isReadOnly(sql)) {
        throw new Error("Only SELECT and WITH statements are allowed");
      }
      // $client is present at runtime but not on the base type — drizzle adds it via the factory.
      const client = (getDb() as unknown as { $client: InstanceType<typeof Database> }).$client;
      const rows = client.prepare(sql).all() as unknown[];
      return ok(rows);
    }
  );
}
