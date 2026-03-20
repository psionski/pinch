import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const INSTRUCTIONS = [
  "Pinch — personal finance tracker. Manage transactions, categories, budgets, recurring templates, and portfolio assets.",
  "All monetary amounts are integers in cents (e.g. 1210 = €12.10).",
  "When creating an investment or crypto asset, ask the user for the ticker/symbol so prices can be tracked automatically.",
  "For analysis not covered by the reporting tools, use get_db_schema to discover table structure, then use the query tool for arbitrary read-only SQL.",
  "Receipt upload flow: POST /api/receipts/upload (multipart/form-data, field: 'image'; optional fields: 'merchant', 'date', 'total', 'raw_text') → returns { receipt_id }.",
  "Pass receipt_id to create_transactions to link line items to the receipt.",
].join(" ");

export function createMcpServer(): McpServer {
  return new McpServer({ name: "pinch", version: "1.0.0" }, { instructions: INSTRUCTIONS });
}
