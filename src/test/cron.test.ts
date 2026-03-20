// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("node-cron", () => ({
  default: { schedule: vi.fn() },
}));
vi.mock("@/lib/api/services", () => ({
  getRecurringService: vi.fn(),
  getFinancialDataService: vi.fn(),
  getAssetPriceService: vi.fn(),
}));
vi.mock("@/lib/services/backup", () => ({
  runBackup: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(() => ({ all: vi.fn(() => []) })) })),
    })),
  })),
}));

describe("initCronJobs singleton guard", () => {
  beforeEach(() => {
    const g = globalThis as unknown as { __pinchCronInit?: boolean };
    delete g.__pinchCronInit;
    vi.clearAllMocks();
  });

  afterEach(() => {
    const g = globalThis as unknown as { __pinchCronInit?: boolean };
    delete g.__pinchCronInit;
  });

  it("sets the global flag and schedules three jobs on first call", async () => {
    const { initCronJobs } = await import("@/lib/cron");
    const cron = (await import("node-cron")).default;

    initCronJobs();

    const g = globalThis as unknown as { __pinchCronInit?: boolean };
    expect(g.__pinchCronInit).toBe(true);
    expect(cron.schedule).toHaveBeenCalledTimes(3);

    expect(cron.schedule).toHaveBeenCalledWith("0 2 * * *", expect.any(Function));
    expect(cron.schedule).toHaveBeenCalledWith("0 3 * * *", expect.any(Function));
    expect(cron.schedule).toHaveBeenCalledWith("0 4 * * *", expect.any(Function));
  });

  it("does not schedule duplicate jobs on second call", async () => {
    const { initCronJobs } = await import("@/lib/cron");
    const cron = (await import("node-cron")).default;

    initCronJobs();
    initCronJobs();

    expect(cron.schedule).toHaveBeenCalledTimes(3);
  });
});

describe("todayString", () => {
  it("returns a YYYY-MM-DD string for the current UTC date", async () => {
    const { todayString } = await import("@/lib/cron");
    const result = todayString();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("runRecurringJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls generatePending with no arguments", async () => {
    const { runRecurringJob } = await import("@/lib/cron");
    const { getRecurringService } = await import("@/lib/api/services");

    const mockGeneratePending = vi.fn().mockReturnValue(3);
    vi.mocked(getRecurringService).mockReturnValue({
      generatePending: mockGeneratePending,
    } as unknown as ReturnType<typeof getRecurringService>);

    runRecurringJob();

    expect(getRecurringService).toHaveBeenCalled();
    expect(mockGeneratePending).toHaveBeenCalledWith();
  });

  it("logs when transactions are generated", async () => {
    const { runRecurringJob } = await import("@/lib/cron");
    const { getRecurringService } = await import("@/lib/api/services");

    vi.mocked(getRecurringService).mockReturnValue({
      generatePending: vi.fn().mockReturnValue(5),
    } as unknown as ReturnType<typeof getRecurringService>);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    runRecurringJob();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("5 recurring transaction(s)"));
    logSpy.mockRestore();
  });

  it("does not log when zero transactions generated", async () => {
    const { runRecurringJob } = await import("@/lib/cron");
    const { getRecurringService } = await import("@/lib/api/services");

    vi.mocked(getRecurringService).mockReturnValue({
      generatePending: vi.fn().mockReturnValue(0),
    } as unknown as ReturnType<typeof getRecurringService>);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    runRecurringJob();
    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("catches and logs errors without throwing", async () => {
    const { runRecurringJob } = await import("@/lib/cron");
    const { getRecurringService } = await import("@/lib/api/services");

    vi.mocked(getRecurringService).mockImplementation(() => {
      throw new Error("db locked");
    });

    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => runRecurringJob()).not.toThrow();
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to generate"),
      expect.any(Error)
    );
    errSpy.mockRestore();
  });
});

describe("runBackupJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls runBackup and logs the result", async () => {
    const { runBackupJob } = await import("@/lib/cron");
    const { runBackup } = await import("@/lib/services/backup");

    vi.mocked(runBackup).mockResolvedValue({ path: "/backups/test.db", rotatedCount: 2 });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await runBackupJob();

    expect(runBackup).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("/backups/test.db"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("rotated 2"));
    logSpy.mockRestore();
  });

  it("catches and logs errors without throwing", async () => {
    const { runBackupJob } = await import("@/lib/cron");
    const { runBackup } = await import("@/lib/services/backup");

    vi.mocked(runBackup).mockRejectedValue(new Error("disk full"));

    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(runBackupJob()).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining("Backup failed"),
      expect.any(Error)
    );
    errSpy.mockRestore();
  });
});
