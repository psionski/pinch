import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTransactionTools } from "./tools/transactions";
import { registerCategoryTools } from "./tools/categories";
import { registerReportTools } from "./tools/reports";
import { registerBudgetTools } from "./tools/budgets";
import { registerRecurringTools } from "./tools/recurring";
import { registerQueryTool } from "./tools/query";
import { registerReceiptTools } from "./tools/receipts";

export function registerTools(server: McpServer): void {
  registerTransactionTools(server);
  registerCategoryTools(server);
  registerReportTools(server);
  registerBudgetTools(server);
  registerRecurringTools(server);
  registerReceiptTools(server);
  registerQueryTool(server);
}
