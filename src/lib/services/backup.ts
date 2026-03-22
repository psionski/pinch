import { Temporal } from "@js-temporal/polyfill";
import Database from "better-sqlite3";
import { mkdirSync, readdirSync, rmSync, statSync } from "fs";
import { join } from "path";

export interface BackupResult {
  path: string;
  rotatedCount: number;
}

export interface BackupOptions {
  /** Directory where backup files are written. Defaults to `./data/backups`. */
  backupDir?: string;
  /** Maximum number of backup files to keep. Oldest are removed first. Defaults to 7. */
  keep?: number;
}

/**
 * Back up the SQLite database at `dbPath` to `backupDir`, then rotate old backups
 * so that at most `keep` files are retained.
 *
 * File naming: `pinch-backup-YYYY-MM-DDTHH-MM-SS.db`
 */
export async function runBackup(
  dbPath: string,
  options: BackupOptions = {}
): Promise<BackupResult> {
  const backupDir = options.backupDir ?? join(process.cwd(), "data", "backups");
  const keep = options.keep ?? 7;

  mkdirSync(backupDir, { recursive: true });

  const timestamp = Temporal.Now.instant()
    .toString()
    .replace(/:/g, "-")
    .replace(/\.\d+Z$/, "");
  const fileName = `pinch-backup-${timestamp}.db`;
  const destPath = join(backupDir, fileName);

  // better-sqlite3's .backup() is async — returns a Promise
  const source = new Database(dbPath, { readonly: true });
  try {
    await source.backup(destPath);
  } finally {
    source.close();
  }

  // Rotate: list backups sorted oldest-first, remove excess
  const files = readdirSync(backupDir)
    .filter((f) => f.startsWith("pinch-backup-") && f.endsWith(".db"))
    .map((f) => ({ name: f, mtime: statSync(join(backupDir, f)).mtimeMs }))
    .sort((a, b) => a.mtime - b.mtime);

  const excess = files.length - keep;
  let rotatedCount = 0;
  if (excess > 0) {
    for (const file of files.slice(0, excess)) {
      rmSync(join(backupDir, file.name));
      rotatedCount++;
    }
  }

  return { path: destPath, rotatedCount };
}
