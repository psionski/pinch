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
import { ok, err } from "@/lib/mcp/response";

export function registerAssetTools(server: McpServer): void {
  server.registerTool(
    "create_asset",
    {
      description:
        "Create a new asset to track in your portfolio. " +
        "To enable automatic price tracking, call search_symbol first, then pass the result as symbolMap. " +
        "For EUR deposits, each unit represents €1 — use buy_asset with quantity = EUR amount and pricePerUnit = 1.",
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
      if (!asset) return err(`Asset ${input.id} not found`);
      return ok(asset);
    }
  );

  server.registerTool(
    "update_asset",
    {
      description:
        "Update asset metadata (name, icon, color, notes, symbolMap). " +
        "Does not affect holdings or prices — use buy_asset/sell_asset for that.",
      inputSchema: IdSchema.merge(UpdateAssetSchema),
    },
    (input) => {
      const { id, ...rest } = input;
      const asset = getAssetService().update(id, rest);
      if (!asset) return err(`Asset ${id} not found`);
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
        "Delete an asset and all its holdings and price history. " +
        "Related transactions are kept. Use list_transactions to find them if needed.",
      inputSchema: IdSchema,
    },
    (input) => {
      const deleted = getAssetService().delete(input.id);
      if (!deleted) return err(`Asset ${input.id} not found`);
      return ok({ success: true });
    }
  );

  server.registerTool(
    "buy_asset",
    {
      description:
        "Record an asset purchase or deposit. Creates a negative-amount transfer transaction (cash out) and adds to holdings. " +
        "For deposits in the configured base currency: pricePerUnit = 1, quantity = the amount. " +
        "For foreign-currency assets, pricePerUnit is in the asset's native currency; the cash side of the transfer " +
        "is denominated in that currency, then converted to the base currency at write time via the FX provider chain.",
      inputSchema: IdSchema.merge(BuyAssetSchema),
    },
    async (input) => {
      const { id, ...rest } = input;
      try {
        return ok(await getAssetLotService().buy(id, rest));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Buy failed";
        return err(msg);
      }
    }
  );

  server.registerTool(
    "sell_asset",
    {
      description:
        "Record an asset sale or withdrawal. Creates a positive-amount transfer transaction (cash in) and reduces holdings. " +
        "Returns error if quantity exceeds current holdings. " +
        "Same currency rules as buy_asset — pricePerUnit is in the asset's native currency.",
      inputSchema: IdSchema.merge(SellAssetSchema),
    },
    async (input) => {
      const { id, ...rest } = input;
      try {
        return ok(await getAssetLotService().sell(id, rest));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Sell failed";
        return err(msg);
      }
    }
  );

  server.registerTool(
    "record_price",
    {
      description:
        "Record a current price snapshot for an asset. " +
        "Use get_price first to fetch the latest market price, then call this to persist it. " +
        "Updates the asset's current value and P&L.",
      inputSchema: IdSchema.merge(RecordPriceSchema),
    },
    (input) => {
      const { id, ...rest } = input;
      try {
        return ok(getAssetPriceService().record(id, rest));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Record failed";
        return err(msg);
      }
    }
  );

  server.registerTool(
    "get_portfolio",
    {
      description:
        "Get the full portfolio: all assets with holdings + P&L, cash balance, total asset value, " +
        "net worth, and allocation percentages. " +
        "For detailed analysis see: get_allocation, get_asset_performance, get_net_worth_history, " +
        "get_realized_pnl, get_currency_exposure, get_asset_history.",
      inputSchema: z.object({}),
    },
    () => ok(getPortfolioService().getPortfolio())
  );

  server.registerTool(
    "list_lots",
    {
      description:
        "List all buy/sell events (lots) for an asset, ordered newest first. " +
        "Positive quantity = buy/deposit, negative = sell/withdrawal.",
      inputSchema: IdSchema,
    },
    (input) => {
      try {
        return ok(getAssetLotService().listLots(input.id));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "List lots failed";
        return err(msg);
      }
    }
  );
}
