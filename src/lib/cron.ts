import cron from "node-cron";
import { getRecurringService, getFinancialDataService } from "@/lib/api/services";
import { runBackup } from "@/lib/services/backup";
import { getDb } from "@/lib/db";
import { assets } from "@/lib/db/schema";
import { isNotNull } from "drizzle-orm";
import { cronLogger } from "@/lib/logger";
import { isoToday } from "@/lib/date-ranges";

const DB_PATH = process.env.DATABASE_URL ?? "./data/pinch.db";

/** Cron callback: generate pending recurring transactions up to today. */
export function runRecurringJob(): void {
  try {
    const service = getRecurringService();
    const created = service.generatePending();
    if (created > 0) {
      cronLogger.info({ count: created }, "Generated recurring transactions");
    }
  } catch (err) {
    cronLogger.error({ err }, "Failed to generate recurring transactions");
  }
}

/** Cron callback: back up the SQLite database and rotate old backups. */
export async function runBackupJob(): Promise<void> {
  try {
    const result = await runBackup(DB_PATH);
    cronLogger.info({ path: result.path, rotated: result.rotatedCount }, "Backup saved");
  } catch (err) {
    cronLogger.error({ err }, "Backup failed");
  }
}

/**
 * Initialise all cron jobs. Guarded by a `globalThis` flag so that
 * Next.js dev-mode hot reloads don't spawn duplicate schedulers.
 */
export function initCronJobs(): void {
  const g = globalThis as unknown as { __pinchCronInit?: boolean };
  if (g.__pinchCronInit) return;
  g.__pinchCronInit = true;

  cron.schedule("0 2 * * *", runRecurringJob);
  cron.schedule("0 3 * * *", () => void runBackupJob());
  cron.schedule("0 4 * * *", () => void runMarketPriceJob());

  cronLogger.info("Scheduled jobs: recurring (02:00), backup (03:00), market prices (04:00)");

  // Startup warm: proactively cache common exchange rates for today
  void warmExchangeRates();
}

/**
 * Cron callback: for each asset with a symbol_map, fetch today's price
 * from providers to warm the market_prices cache.
 */
async function runMarketPriceJob(): Promise<void> {
  try {
    const db = getDb();
    const fds = getFinancialDataService();
    const today = isoToday();

    const symbolAssets = db
      .select({
        id: assets.id,
        symbolMap: assets.symbolMap,
        currency: assets.currency,
      })
      .from(assets)
      .where(isNotNull(assets.symbolMap))
      .all();

    let warmed = 0;
    for (const asset of symbolAssets) {
      if (!asset.symbolMap) continue;
      const map = JSON.parse(asset.symbolMap) as Record<string, string>;

      try {
        for (const symbol of Object.values(map)) {
          const result = await fds.getPrice(symbol, asset.currency, today);
          if (result) {
            warmed++;
            break;
          }
        }
      } catch {
        // Continue with next asset — individual failures are non-fatal
      }
    }

    if (warmed > 0) {
      cronLogger.info({ warmed, total: symbolAssets.length }, "Warmed market prices");
    }
  } catch (err) {
    cronLogger.error({ err }, "Market price job failed");
  }
}

async function warmExchangeRates(): Promise<void> {
  try {
    const svc = getFinancialDataService();
    await Promise.all([svc.getPrice("USD", "EUR"), svc.getPrice("GBP", "EUR")]);
    cronLogger.info("Exchange rate cache warmed (USD/EUR, GBP/EUR)");
  } catch (err) {
    cronLogger.warn({ err }, "Exchange rate warm-up failed (non-fatal)");
  }
}
