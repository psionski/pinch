import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GetPriceSchema, ConvertCurrencySchema, SetApiKeySchema } from "@/lib/validators/financial";
import { z } from "zod";
import { getFinancialDataService, getSettingsService } from "@/lib/api/services";
import { getProviderStatuses, getUnconfiguredProviders } from "@/lib/providers/registry";

function ok(data: unknown): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

function notFound(msg: string): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text", text: JSON.stringify({ error: msg }) }] };
}

function unconfiguredProviderHint(): string | null {
  const missing = getUnconfiguredProviders(getSettingsService());
  if (missing.length === 0) return null;
  return `Providers [${missing.join(", ")}] are not configured — use set_api_key to add API keys if this symbol requires them.`;
}

export function registerFinancialTools(server: McpServer): void {
  server.registerTool(
    "convert_currency",
    {
      description:
        "Convert an amount between currencies using live exchange rates. " +
        "Requires a symbolMap specifying which providers to use (e.g. { frankfurter: 'USD' }). " +
        "Use search_symbol to find the correct provider→symbol mapping.",
      inputSchema: ConvertCurrencySchema,
    },
    async (input) => {
      const result = await getFinancialDataService().convert(
        input.amount,
        input.from,
        input.to,
        input.symbolMap,
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
        "Requires a symbolMap specifying which providers to use " +
        "(e.g. { coingecko: 'bitcoin' } or { frankfurter: 'USD' }). " +
        "Use search_symbol to find the correct provider→symbol mapping.",
      inputSchema: GetPriceSchema,
    },
    async (input) => {
      const svc = getFinancialDataService();
      const result = await svc.getPrice(input.symbolMap, input.currency, input.date);
      if (!result) {
        const symbols = Object.values(input.symbolMap).filter(Boolean).join(", ");
        const msg = `No price available for ${symbols}/${input.currency}`;
        const hint = unconfiguredProviderHint();
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
      const statuses = await getProviderStatuses(getSettingsService());
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
        const hint = unconfiguredProviderHint();
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
