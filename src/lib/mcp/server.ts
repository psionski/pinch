import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const INSTRUCTIONS = [
  "Personal finance tracker.",
  "Receipt images: upload via POST /api/receipts/upload",
  "(multipart/form-data, field: 'image', optional fields: 'merchant', 'date', 'total', 'raw_text')",
  "→ returns { receipt_id }.",
  "Then pass receipt_id to add_transactions to link line items to the receipt.",
  "All monetary amounts are integers in cents (e.g. 1210 = €12.10).",
].join(" ");

export function createMcpServer(): McpServer {
  return new McpServer({ name: "pinch", version: "1.0.0" }, { instructions: INSTRUCTIONS });
}
