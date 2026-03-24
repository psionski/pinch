/** Standard MCP tool response shape. */
type McpToolResponse = { content: [{ type: "text"; text: string }] };

/** Return a successful MCP tool response with JSON-serialized data. */
export function ok(data: unknown): McpToolResponse {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

/** Return an MCP tool error response with a message. */
export function err(msg: string): McpToolResponse {
  return { content: [{ type: "text", text: JSON.stringify({ error: msg }) }] };
}
