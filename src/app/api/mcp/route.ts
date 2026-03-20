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

// GET (SSE) and DELETE (session teardown) are not supported in stateless JSON
// response mode. Return 405 immediately rather than spinning up a server.
export function GET(): Response {
  return new Response(null, { status: 405 });
}

export function DELETE(): Response {
  return new Response(null, { status: 405 });
}
