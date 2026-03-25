/**
 * Prepare the test DB for E2E tests.
 * Runs before `next dev` as part of the webServer command chain.
 *
 * 1. Kill any leftover server on port 4001
 * 2. Delete old test DB files
 * 3. Run the seed script
 */
import { execSync } from "child_process";
import { existsSync, rmSync } from "fs";
import killPort from "kill-port";

const DB_PATH = process.env.DATABASE_URL ?? "./data/test-e2e.db";

async function main(): Promise<void> {
  // Kill leftover server from a crashed previous run
  await killPort(4001).catch(() => {
    // No process on port 4001 — fine
  });

  // Remove stale Next.js dev lock (left over from crashed runs)
  const lockPath = ".next/dev/lock";
  if (existsSync(lockPath)) rmSync(lockPath, { force: true });

  // Delete old DB + WAL/SHM files
  for (const suffix of ["", "-wal", "-shm"]) {
    const p = `${DB_PATH}${suffix}`;
    if (existsSync(p)) rmSync(p, { force: true, maxRetries: 3, retryDelay: 500 });
  }

  // Seed
  execSync(`cross-env DATABASE_URL=${DB_PATH} tsx src/lib/db/seed/index.ts`, {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  console.log("[e2e] DB prepared, starting server...");
}

void main();
