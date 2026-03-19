import cron from "node-cron";
import { getRecurringService } from "@/lib/api/services";
import { runBackup } from "@/lib/services/backup";

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

  console.log("[cron] Scheduled jobs: recurring generation (02:00), backup (03:00)");
}
