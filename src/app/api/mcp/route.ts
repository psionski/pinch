import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/lib/mcp/server";
import { registerTools } from "@/lib/mcp/register";

export async function POST(req: Request): Promise<Response> {
  const server = createMcpServer();
  registerTools(server);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  return transport.handleRequest(req);
}

// MCP Streamable HTTP also allows GET (SSE) and DELETE (session teardown).
// In stateless mode these are no-ops, but we forward them so MCP-spec clients
// that probe capabilities receive proper responses.
export async function GET(req: Request): Promise<Response> {
  const server = createMcpServer();
  registerTools(server);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  return transport.handleRequest(req);
}

export async function DELETE(req: Request): Promise<Response> {
  const server = createMcpServer();
  registerTools(server);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  return transport.handleRequest(req);
}
