import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  GetExchangeRateSchema,
  ConvertCurrencySchema,
  GetMarketPriceSchema,
  SetApiKeySchema,
} from "@/lib/validators/financial";
import { getFinancialDataService } from "@/lib/api/services";

function ok(data: unknown): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

function notFound(msg: string): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text", text: JSON.stringify({ error: msg }) }] };
}

export function registerFinancialTools(server: McpServer): void {
  server.registerTool(
    "convert_currency",
    {
      description:
        "Convert an amount between currencies using live exchange rates. " +
        "Params: amount (cents, e.g. 1599 = $15.99), from (source currency, e.g. 'USD'), " +
        "to (target currency, e.g. 'EUR'), date (optional YYYY-MM-DD, defaults to today). " +
        "Returns converted amount in cents, exchange rate, date, provider, and stale flag. " +
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
    "get_exchange_rate",
    {
      description:
        "Look up an exchange rate between two currencies. " +
        "Params: base (e.g. 'USD'), quote (e.g. 'EUR'), date (optional YYYY-MM-DD, defaults to today). " +
        "Returns rate (1 base = rate quote), date, provider, and stale flag.",
      inputSchema: GetExchangeRateSchema,
    },
    async (input) => {
      const result = await getFinancialDataService().getExchangeRate(
        input.base,
        input.quote,
        input.date
      );
      if (!result) return notFound(`No exchange rate available for ${input.base}/${input.quote}`);
      return ok(result);
    }
  );

  server.registerTool(
    "get_market_price",
    {
      description:
        "Look up a market price for a crypto, stock, or ETF. " +
        "Params: symbol (CoinGecko ID for crypto e.g. 'bitcoin', or ticker for stocks e.g. 'AAPL'), " +
        "currency (optional, defaults to 'EUR'), date (optional YYYY-MM-DD, defaults to today). " +
        "Returns price, currency, date, provider, and stale flag.",
      inputSchema: GetMarketPriceSchema,
    },
    async (input) => {
      const result = await getFinancialDataService().getMarketPrice(
        input.symbol,
        input.currency,
        input.date
      );
      if (!result) return notFound(`No price available for ${input.symbol}`);
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
    "set_api_key",
    {
      description:
        "Configure an API key for a financial data provider. " +
        "Params: provider (one of: 'open-exchange-rates', 'coingecko', 'alpha-vantage'), key (the API key). " +
        "Keys are stored securely in the settings table.",
      inputSchema: SetApiKeySchema,
    },
    (input) => {
      getFinancialDataService().setApiKey(input.provider, input.key);
      return ok({ success: true, provider: input.provider });
    }
  );
}
