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

const DB_PATH = process.env.DATABASE_URL ?? "./data/test-e2e.db";

// Kill leftover server from a crashed previous run
try {
  if (process.platform === "win32") {
    const result = execSync("netstat -ano | findstr :4001 | findstr LISTENING", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const pids = new Set(
      result
        .trim()
        .split("\n")
        .map((line) => line.trim().split(/\s+/).pop()!)
        .filter(Boolean)
    );
    for (const pid of pids) {
      execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
    }
  } else {
    execSync("lsof -ti:4001 | xargs kill -9", { stdio: "ignore" });
  }
} catch {
  // No process on port 4001 — fine
}

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
