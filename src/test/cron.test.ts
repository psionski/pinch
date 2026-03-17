// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("node-cron", () => ({
  default: { schedule: vi.fn() },
}));
vi.mock("@/lib/api/services", () => ({
  getRecurringService: vi.fn(),
}));
vi.mock("@/lib/services/backup", () => ({
  runBackup: vi.fn(),
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

  it("sets the global flag and schedules two jobs on first call", async () => {
    const { initCronJobs } = await import("@/lib/cron");
    const cron = (await import("node-cron")).default;

    initCronJobs();

    const g = globalThis as unknown as { __pinchCronInit?: boolean };
    expect(g.__pinchCronInit).toBe(true);
    expect(cron.schedule).toHaveBeenCalledTimes(2);

    // Verify cron expressions
    expect(cron.schedule).toHaveBeenCalledWith("0 2 * * *", expect.any(Function));
    expect(cron.schedule).toHaveBeenCalledWith("0 3 * * *", expect.any(Function));
  });

  it("does not schedule duplicate jobs on second call", async () => {
    const { initCronJobs } = await import("@/lib/cron");
    const cron = (await import("node-cron")).default;

    initCronJobs();
    initCronJobs(); // second call should be a no-op

    expect(cron.schedule).toHaveBeenCalledTimes(2); // still only 2, not 4
  });
});
