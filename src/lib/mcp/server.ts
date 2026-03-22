import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const INSTRUCTIONS = [
  "Pinch — personal finance tracker. Manage transactions, categories, budgets, recurring templates, and portfolio assets.",
  "All monetary amounts are integers in cents (e.g. 1210 = €12.10).",
  "On first interaction, call get_timezone. If it returns null, the timezone has not been configured — ask the user for their timezone and call set_timezone before proceeding. If it returns a timezone, compare it against the user's local timezone and prompt if there's a mismatch.",
  "When creating an investment, crypto, or foreign currency asset, use search_symbol to find the correct market identifier, then pass it as symbolMap to create_asset. This enables automatic price tracking. If search_symbol returns no results, create the asset without symbolMap and use record_price to update prices manually.",
  "For analysis not covered by the reporting tools, use get_db_schema to discover table structure, then use the query tool for arbitrary read-only SQL.",
  "Receipt upload flow: POST /api/receipts/upload (multipart/form-data, field: 'image'; optional fields: 'merchant', 'date', 'total', 'raw_text') → returns { receipt_id }.",
  "Pass receipt_id to create_transactions to link line items to the receipt.",
].join(" ");

export function createMcpServer(): McpServer {
  return new McpServer(
    { name: "pinch", version: process.env.npm_package_version ?? "0.0.0" },
    { instructions: INSTRUCTIONS }
  );
}
