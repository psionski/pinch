import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GetPriceSchema, ConvertCurrencySchema, SetApiKeySchema } from "@/lib/validators/financial";
import { z } from "zod";
import { getFinancialDataService } from "@/lib/api/services";

function ok(data: unknown): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

function notFound(msg: string): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text", text: JSON.stringify({ error: msg }) }] };
}

async function unconfiguredProviderHint(
  svc: ReturnType<typeof getFinancialDataService>
): Promise<string | null> {
  const statuses = await svc.getProviderStatus();
  const missing = statuses.filter((s) => s.apiKeyRequired && !s.apiKeySet).map((s) => s.name);
  if (missing.length === 0) return null;
  return `Providers [${missing.join(", ")}] are not configured — use set_api_key to add API keys if this symbol requires them.`;
}

export function registerFinancialTools(server: McpServer): void {
  server.registerTool(
    "convert_currency",
    {
      description:
        "Convert an amount between currencies using live exchange rates. " +
        "Primary use case: receipt in foreign currency → EUR for transaction entry.",
      inputSchema: ConvertCurrencySchema,
    },
    async (input) => {
      const result = await getFinancialDataService().convert(
        input.amount,
        input.from,
        input.to,
        input.date
      );
      if (!result) return notFound(`No exchange rate available for ${input.from}→${input.to}`);
      return ok(result);
    }
  );

  server.registerTool(
    "get_price",
    {
      description:
        "Look up a price for a currency pair, crypto, stock, or ETF. " +
        "Use search_symbol to find the correct symbol identifier. " +
        "Works for exchange rates too: symbol='USD', currency='EUR' gives the EUR value of 1 USD.",
      inputSchema: GetPriceSchema,
    },
    async (input) => {
      const svc = getFinancialDataService();
      const result = await svc.getPrice(input.symbol, input.currency, input.date);
      if (!result) {
        const msg = `No price available for ${input.symbol}/${input.currency}`;
        const hint = await unconfiguredProviderHint(svc);
        return notFound(hint ? `${msg}. ${hint}` : msg);
      }
      return ok(result);
    }
  );

  server.registerTool(
    "list_providers",
    {
      description:
        "List all configured financial data providers with their status. " +
        "Shows which providers are active, whether an API key is set, and health status.",
      inputSchema: {},
    },
    async () => {
      const statuses = await getFinancialDataService().getProviderStatus();
      return ok(statuses);
    }
  );

  server.registerTool(
    "search_symbol",
    {
      description:
        "Search for a market symbol by name. Use before creating/updating an asset or calling get_price. " +
        "Pass the best match as symbolMap: { [result.provider]: result.symbol } to create_asset or update_asset " +
        "for automatic price tracking. For exchange rates, search the currency code (e.g. 'USD'). " +
        "If no results, you can still create the asset without symbolMap and use record_price manually.",
      inputSchema: z.object({
        query: z.string().min(1, "Search query is required"),
      }),
    },
    async (input) => {
      const svc = getFinancialDataService();
      const results = await svc.searchSymbol(input.query);
      if (results.length === 0) {
        const msg = `No symbols found for "${input.query}"`;
        const hint = await unconfiguredProviderHint(svc);
        return notFound(hint ? `${msg}. ${hint}` : msg);
      }
      return ok(results);
    }
  );

  server.registerTool(
    "set_api_key",
    {
      description: "Configure an API key for a financial data provider.",
      inputSchema: SetApiKeySchema,
    },
    (input) => {
      getFinancialDataService().setApiKey(input.provider, input.key);
      return ok({ success: true, provider: input.provider });
    }
  );
}
