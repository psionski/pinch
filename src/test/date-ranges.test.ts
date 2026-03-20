// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  computePresetRange,
  computeCompareRange,
  getCurrentMonth,
  getCurrentMonthInfo,
  getPreviousMonthRange,
  DEFAULT_PRESET,
  PRESET_LABELS,
} from "@/lib/date-ranges";
import type { DateRange } from "@/lib/date-ranges";

// Pin "now" to 2026-03-19 for deterministic tests
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 2, 19)); // March 19, 2026
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── constants ───────────────────────────────────────────────────────────────

describe("constants", () => {
  it("DEFAULT_PRESET is 6m", () => {
    expect(DEFAULT_PRESET).toBe("6m");
  });

  it("PRESET_LABELS has all presets", () => {
    expect(PRESET_LABELS).toEqual({
      "this-month": "This Month",
      "last-month": "Last Month",
      "3m": "3 Months",
      "6m": "6 Months",
      "12m": "12 Months",
      ytd: "YTD",
      custom: "Custom",
    });
  });
});

// ─── computePresetRange ──────────────────────────────────────────────────────

describe("computePresetRange", () => {
  it("this-month returns current month boundaries", () => {
    const range = computePresetRange("this-month");
    expect(range.dateFrom).toBe("2026-03-01");
    expect(range.dateTo).toBe("2026-03-31");
  });

  it("last-month returns previous month boundaries", () => {
    const range = computePresetRange("last-month");
    expect(range.dateFrom).toBe("2026-02-01");
    expect(range.dateTo).toBe("2026-02-28");
  });

  it("3m covers 3 months ending with the current month", () => {
    const range = computePresetRange("3m");
    expect(range.dateFrom).toBe("2026-01-01");
    expect(range.dateTo).toBe("2026-03-31");
  });

  it("6m covers 6 months ending with the current month", () => {
    const range = computePresetRange("6m");
    expect(range.dateFrom).toBe("2025-10-01");
    expect(range.dateTo).toBe("2026-03-31");
  });

  it("12m covers 12 months ending with the current month", () => {
    const range = computePresetRange("12m");
    expect(range.dateFrom).toBe("2025-04-01");
    expect(range.dateTo).toBe("2026-03-31");
  });

  it("ytd runs from Jan 1 of the current year to end of current month", () => {
    const range = computePresetRange("ytd");
    expect(range.dateFrom).toBe("2026-01-01");
    expect(range.dateTo).toBe("2026-03-31");
  });

  it("handles year boundaries correctly for 12m in January", () => {
    vi.setSystemTime(new Date(2026, 0, 15)); // January 15, 2026
    const range = computePresetRange("12m");
    expect(range.dateFrom).toBe("2025-02-01");
    expect(range.dateTo).toBe("2026-01-31");
  });

  it("last-month at January wraps to December of previous year", () => {
    vi.setSystemTime(new Date(2026, 0, 10)); // January 10, 2026
    const range = computePresetRange("last-month");
    expect(range.dateFrom).toBe("2025-12-01");
    expect(range.dateTo).toBe("2025-12-31");
  });
});

// ─── computeCompareRange ─────────────────────────────────────────────────────

describe("computeCompareRange", () => {
  it("computes comparison period for a 1-month range", () => {
    const range: DateRange = { dateFrom: "2026-03-01", dateTo: "2026-03-31" };
    const result = computeCompareRange(range);

    expect(result.months).toBe(1);
    expect(result.compareDateFrom).toBe("2026-02-01");
    expect(result.compareDateTo).toBe("2026-02-28");
    // Original range is preserved
    expect(result.dateFrom).toBe("2026-03-01");
    expect(result.dateTo).toBe("2026-03-31");
  });

  it("computes comparison period for a 3-month range", () => {
    const range: DateRange = { dateFrom: "2026-01-01", dateTo: "2026-03-31" };
    const result = computeCompareRange(range);

    expect(result.months).toBe(3);
    expect(result.compareDateFrom).toBe("2025-10-01");
    expect(result.compareDateTo).toBe("2025-12-31");
  });

  it("computes comparison period for a 6-month range", () => {
    const range: DateRange = { dateFrom: "2025-10-01", dateTo: "2026-03-31" };
    const result = computeCompareRange(range);

    expect(result.months).toBe(6);
    expect(result.compareDateFrom).toBe("2025-04-01");
    expect(result.compareDateTo).toBe("2025-09-30");
  });

  it("computes comparison period for a 12-month range", () => {
    const range: DateRange = { dateFrom: "2025-04-01", dateTo: "2026-03-31" };
    const result = computeCompareRange(range);

    expect(result.months).toBe(12);
    expect(result.compareDateFrom).toBe("2024-04-01");
    expect(result.compareDateTo).toBe("2025-03-31");
  });

  it("handles cross-year boundaries", () => {
    const range: DateRange = { dateFrom: "2025-11-01", dateTo: "2026-02-28" };
    const result = computeCompareRange(range);

    expect(result.months).toBe(4);
    expect(result.compareDateFrom).toBe("2025-07-01");
    expect(result.compareDateTo).toBe("2025-10-31");
  });
});

// ─── getCurrentMonth ────────────────────────────────────────────────────────

describe("getCurrentMonth", () => {
  it("returns YYYY-MM for the current month", () => {
    expect(getCurrentMonth()).toBe("2026-03");
  });

  it("zero-pads single-digit months", () => {
    vi.setSystemTime(new Date(2026, 0, 15)); // January
    expect(getCurrentMonth()).toBe("2026-01");
  });
});

// ─── getCurrentMonthInfo ────────────────────────────────────────────────────

describe("getCurrentMonthInfo", () => {
  it("returns month string, start, end, and label", () => {
    const info = getCurrentMonthInfo();
    expect(info.currentMonth).toBe("2026-03");
    expect(info.monthStart).toBe("2026-03-01");
    expect(info.monthEnd).toBe("2026-03-31");
    expect(info.monthLabel).toBe("March 2026");
  });

  it("handles February correctly", () => {
    vi.setSystemTime(new Date(2026, 1, 10)); // February 2026
    const info = getCurrentMonthInfo();
    expect(info.monthEnd).toBe("2026-02-28");
  });
});

// ─── getPreviousMonthRange ──────────────────────────────────────────────────

describe("getPreviousMonthRange", () => {
  it("returns the previous month start and end", () => {
    const { prevMonthStart, prevMonthEnd } = getPreviousMonthRange("2026-03");
    expect(prevMonthStart).toBe("2026-02-01");
    expect(prevMonthEnd).toBe("2026-02-28");
  });

  it("wraps to December of previous year from January", () => {
    const { prevMonthStart, prevMonthEnd } = getPreviousMonthRange("2026-01");
    expect(prevMonthStart).toBe("2025-12-01");
    expect(prevMonthEnd).toBe("2025-12-31");
  });
});
