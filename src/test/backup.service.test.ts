// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, readdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import Database from "better-sqlite3";
import { runBackup } from "@/lib/services/backup";

describe("runBackup", () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `pinch-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });
    dbPath = join(tmpDir, "test.db");
    const db = new Database(dbPath);
    db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)");
    db.exec("INSERT INTO t VALUES (1)");
    db.close();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates a backup file", async () => {
    const backupDir = join(tmpDir, "backups");
    const result = await runBackup(dbPath, { backupDir });

    expect(result.path).toContain("pinch-backup-");
    expect(result.rotatedCount).toBe(0);

    const files = readdirSync(backupDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^pinch-backup-.*\.db$/);

    // Verify the backup is a valid SQLite database
    const backup = new Database(result.path, { readonly: true });
    const rows = backup.prepare("SELECT * FROM t").all();
    backup.close();
    expect(rows).toHaveLength(1);
  });

  it("rotates old backups when exceeding keep limit", async () => {
    const backupDir = join(tmpDir, "backups");
    mkdirSync(backupDir, { recursive: true });

    // Create 3 pre-existing "backup" files with staggered mtimes
    for (let i = 0; i < 3; i++) {
      const fName = `pinch-backup-2026-01-0${i + 1}T00-00-00.db`;
      writeFileSync(join(backupDir, fName), "fake");
    }

    // Run backup with keep=2 — we'll have 4 total, should keep only 2
    const result = await runBackup(dbPath, { backupDir, keep: 2 });

    expect(result.rotatedCount).toBe(2);
    const files = readdirSync(backupDir).filter(
      (f) => f.startsWith("pinch-backup-") && f.endsWith(".db")
    );
    expect(files).toHaveLength(2);

    // The newest backup should be the one we just created
    expect(files).toContain(result.path.split(/[\\/]/).pop());
  });
});
