import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CreateAssetSchema,
  UpdateAssetSchema,
  BuyAssetSchema,
  SellAssetSchema,
  RecordPriceSchema,
} from "@/lib/validators/assets";
import { IdSchema } from "@/lib/validators/common";
import { z } from "zod";
import {
  getAssetService,
  getAssetLotService,
  getAssetPriceService,
  getPortfolioService,
  getFinancialDataService,
} from "@/lib/api/services";
import { getDb } from "@/lib/db";
import { triggerSymbolBackfill } from "@/lib/services/symbol-backfill";

function ok(data: unknown): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

function notFound(msg: string): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text", text: JSON.stringify({ error: msg }) }] };
}

export function registerAssetTools(server: McpServer): void {
  server.registerTool(
    "create_asset",
    {
      description:
        "Create a new asset to track in your portfolio. " +
        "Types: 'deposit' (savings/bank accounts), 'investment' (stocks/ETFs), 'crypto', 'other'. " +
        "Currency defaults to 'EUR'. Optional 'symbolMap' enables automatic price tracking — " +
        "a JSON object mapping provider names to symbols, e.g. { coingecko: 'bitcoin' } or { 'alpha-vantage': 'AAPL' }. " +
        "Use search_symbol first to discover the correct provider-symbol pairs. " +
        "For EUR deposits, each unit represents €1 — use buy_asset with quantity = EUR amount and pricePerUnit = 100. " +
        "Example: create_asset({ name: 'Bitcoin', type: 'crypto', symbolMap: { coingecko: 'bitcoin' }, currency: 'EUR' })",
      inputSchema: CreateAssetSchema,
    },
    (input) => {
      const asset = getAssetService().create(input);
      if (asset.symbolMap) {
        triggerSymbolBackfill(getDb(), getFinancialDataService(), asset);
      }
      return ok(asset);
    }
  );

  server.registerTool(
    "list_assets",
    {
      description:
        "List all assets with current holdings, cost basis, current value, and P&L. " +
        "currentValue is null if no price has been recorded (except EUR deposits which assume €1/unit). " +
        "pnl = currentValue - costBasis.",
      inputSchema: z.object({}),
    },
    () => ok(getAssetService().list())
  );

  server.registerTool(
    "get_asset",
    {
      description:
        "Get a single asset with full metrics (holdings, cost basis, current value, P&L).",
      inputSchema: IdSchema,
    },
    (input) => {
      const asset = getAssetService().getById(input.id);
      if (!asset) return notFound(`Asset ${input.id} not found`);
      return ok(asset);
    }
  );

  server.registerTool(
    "update_asset",
    {
      description:
        "Update asset metadata (name, icon, color, notes, symbolMap). " +
        "Set 'symbolMap' to enable automatic price tracking, e.g. { coingecko: 'bitcoin' }. " +
        "Use search_symbol to discover correct symbols. Set symbolMap to null to disable automatic pricing. " +
        "Does not affect lots or prices. Use buy_asset/sell_asset to record transactions.",
      inputSchema: IdSchema.merge(UpdateAssetSchema),
    },
    (input) => {
      const { id, ...rest } = input;
      const asset = getAssetService().update(id, rest);
      if (!asset) return notFound(`Asset ${id} not found`);
      if (rest.symbolMap) {
        triggerSymbolBackfill(getDb(), getFinancialDataService(), asset);
      }
      return ok(asset);
    }
  );

  server.registerTool(
    "delete_asset",
    {
      description:
        "Delete an asset and all its lots and price history. " +
        "The linked transfer transactions are kept (they record the cash flow).",
      inputSchema: IdSchema,
    },
    (input) => {
      const deleted = getAssetService().delete(input.id);
      if (!deleted) return notFound(`Asset ${input.id} not found`);
      return ok({ success: true });
    }
  );

  server.registerTool(
    "buy_asset",
    {
      description:
        "Record an asset purchase or deposit. Creates a transfer transaction (cash out) + asset lot atomically. " +
        "Params: id (asset ID), quantity (positive number, can be fractional e.g. 0.5 BTC), " +
        "pricePerUnit (cents, e.g. 34563 = €345.63), date (YYYY-MM-DD). " +
        "Example: buy 10 SPX at €345.63 → quantity: 10, pricePerUnit: 34563. " +
        "IMPORTANT for EUR deposits: pricePerUnit must be 100 (€1.00 per unit). Use quantity to represent the EUR amount " +
        "(e.g. quantity: 5000, pricePerUnit: 100 for a €5,000 deposit). " +
        "Returns { lot, transaction }.",
      inputSchema: IdSchema.merge(BuyAssetSchema),
    },
    (input) => {
      const { id, ...rest } = input;
      try {
        return ok(getAssetLotService().buy(id, rest));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Buy failed";
        return notFound(msg);
      }
    }
  );

  server.registerTool(
    "sell_asset",
    {
      description:
        "Record an asset sale or withdrawal. Creates a transfer transaction (cash in) + negative lot atomically. " +
        "Params: id (asset ID), quantity (positive number to sell), pricePerUnit (cents), date (YYYY-MM-DD). " +
        "Returns error if quantity exceeds current holdings. " +
        "Returns { lot, transaction }.",
      inputSchema: IdSchema.merge(SellAssetSchema),
    },
    (input) => {
      const { id, ...rest } = input;
      try {
        return ok(getAssetLotService().sell(id, rest));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Sell failed";
        return notFound(msg);
      }
    }
  );

  server.registerTool(
    "record_price",
    {
      description:
        "Record a current price snapshot for an asset. " +
        "Use get_market_price first to fetch the latest price, then call this to persist it. " +
        "Params: id (asset ID), pricePerUnit (cents), recordedAt (optional ISO datetime, defaults to now). " +
        "This updates currentValue and P&L calculations.",
      inputSchema: IdSchema.merge(RecordPriceSchema),
    },
    (input) => {
      const { id, ...rest } = input;
      try {
        return ok(getAssetPriceService().record(id, rest));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Record failed";
        return notFound(msg);
      }
    }
  );

  server.registerTool(
    "get_portfolio",
    {
      description:
        "Get the full portfolio: all assets with holdings + P&L, cash balance, total asset value, net worth, and allocation percentages. " +
        "Net worth = cash balance (income - expenses) + total asset value. " +
        "Transfers are excluded from the cash balance calculation.",
      inputSchema: z.object({}),
    },
    () => ok(getPortfolioService().getPortfolio())
  );

  server.registerTool(
    "get_price_history",
    {
      description:
        "Get the price history (time series) for a single asset, ordered oldest to newest. Useful for charting.",
      inputSchema: IdSchema,
    },
    (input) => ok(getAssetPriceService().getHistory(input.id))
  );

  server.registerTool(
    "list_lots",
    {
      description:
        "List all buy/sell events (lots) for an asset, ordered newest first. " +
        "Positive quantity = buy/deposit, negative = sell/withdrawal.",
      inputSchema: IdSchema,
    },
    (input) => ok(getAssetLotService().listLots(input.id))
  );
}
