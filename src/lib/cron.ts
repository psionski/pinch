import cron from "node-cron";
import {
  getRecurringService,
  getFinancialDataService,
  getAssetPriceService,
} from "@/lib/api/services";
import { runBackup } from "@/lib/services/backup";
import { getDb } from "@/lib/db";
import { assets } from "@/lib/db/schema";
import { isNotNull } from "drizzle-orm";

const DB_PATH = process.env.DATABASE_URL ?? "./data/pinch.db";

export function todayString(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Cron callback: generate pending recurring transactions up to today. */
export function runRecurringJob(): void {
  try {
    const service = getRecurringService();
    const created = service.generatePending();
    if (created > 0) {
      console.log(`[cron] Generated ${created} recurring transaction(s)`);
    }
  } catch (err) {
    console.error("[cron] Failed to generate recurring transactions:", err);
  }
}

/** Cron callback: back up the SQLite database and rotate old backups. */
export async function runBackupJob(): Promise<void> {
  try {
    const result = await runBackup(DB_PATH);
    console.log(`[cron] Backup saved to ${result.path} (rotated ${result.rotatedCount})`);
  } catch (err) {
    console.error("[cron] Backup failed:", err);
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

  console.log("[cron] Scheduled jobs: recurring (02:00), backup (03:00), market prices (04:00)");

  // Startup warm: proactively cache common exchange rates for today
  void warmExchangeRates();
}

/**
 * Cron callback: for each asset with a symbol_map, fetch today's price
 * from the first matching provider and record it as an asset_prices snapshot.
 */
async function runMarketPriceJob(): Promise<void> {
  try {
    const db = getDb();
    const fds = getFinancialDataService();
    const priceService = getAssetPriceService();
    const today = todayString();

    const symbolAssets = db
      .select({
        id: assets.id,
        symbolMap: assets.symbolMap,
        currency: assets.currency,
      })
      .from(assets)
      .where(isNotNull(assets.symbolMap))
      .all();

    let recorded = 0;
    for (const asset of symbolAssets) {
      if (!asset.symbolMap) continue;
      const map = JSON.parse(asset.symbolMap) as Record<string, string>;

      try {
        // Try each symbol in the map until one returns a price
        for (const symbol of Object.values(map)) {
          const result = await fds.getMarketPrice(symbol, asset.currency, today);
          if (result) {
            const priceCents = Math.round(result.price * 100);
            priceService.record(asset.id, {
              pricePerUnit: priceCents,
              recordedAt: new Date().toISOString(),
            });
            recorded++;
            break;
          }
        }
      } catch {
        // Continue with next asset — individual failures are non-fatal
      }
    }

    if (recorded > 0) {
      console.log(`[cron] Recorded market prices for ${recorded}/${symbolAssets.length} assets`);
    }
  } catch (err) {
    console.error("[cron] Market price job failed:", err);
  }
}

async function warmExchangeRates(): Promise<void> {
  try {
    const svc = getFinancialDataService();
    await Promise.all([svc.getExchangeRate("USD", "EUR"), svc.getExchangeRate("GBP", "EUR")]);
    console.log("[cron] Exchange rate cache warmed (USD/EUR, GBP/EUR)");
  } catch (err) {
    console.warn("[cron] Exchange rate warm-up failed (non-fatal):", err);
  }
}
