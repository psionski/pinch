import { getFinancialDataService } from "@/lib/api/services";
import { parseSearchParams, isErrorResponse } from "@/lib/api/helpers";
import { SearchSymbolQuerySchema } from "@/lib/validators/financial";

export async function GET(req: Request): Promise<Response> {
  const input = parseSearchParams(req.url, SearchSymbolQuerySchema);
  if (isErrorResponse(input)) return input;

  const service = getFinancialDataService();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const batch of service.searchSymbolStream(input.query, input.assetType)) {
          const event = `event: results\ndata: ${JSON.stringify(batch)}\n\n`;
          controller.enqueue(encoder.encode(event));
        }
        controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
      } catch {
        controller.enqueue(encoder.encode("event: error\ndata: {}\n\n"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
