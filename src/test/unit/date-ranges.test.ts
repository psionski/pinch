// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isoToday,
  offsetDate,
  daysBetween,
  isoDateFromMs,
  computePresetRange,
  computeCompareRange,
  getCurrentMonth,
  getCurrentMonthInfo,
  getPreviousMonthRange,
  setUserTimezone,
  DEFAULT_PRESET,
  PRESET_LABELS,
} from "@/lib/date-ranges";
import type { DateRange } from "@/lib/date-ranges";

// Pin "now" to 2026-03-19 UTC for deterministic tests
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(Date.UTC(2026, 2, 19))); // March 19, 2026 UTC
  setUserTimezone("UTC"); // default to UTC for all tests
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
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 15))); // January 15, 2026 UTC
    const range = computePresetRange("12m");
    expect(range.dateFrom).toBe("2025-02-01");
    expect(range.dateTo).toBe("2026-01-31");
  });

  it("last-month at January wraps to December of previous year", () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 10))); // January 10, 2026 UTC
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
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 15))); // January UTC
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
    vi.setSystemTime(new Date(Date.UTC(2026, 1, 10))); // February 2026 UTC
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

// ─── isoToday ────────────────────────────────────────────────────────────────

describe("isoToday", () => {
  it("returns the current date as YYYY-MM-DD (defaults to UTC)", () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 2, 19, 23, 30)));
    expect(isoToday()).toBe("2026-03-19");
  });

  it("handles UTC midnight boundary correctly", () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 2, 20, 0, 30)));
    expect(isoToday()).toBe("2026-03-20");
  });

  it("returns correct date when user timezone is ahead of UTC", () => {
    // 22:30 UTC on March 19 = 00:30 on March 20 in Europe/Helsinki (UTC+2)
    vi.setSystemTime(new Date(Date.UTC(2026, 2, 19, 22, 30)));
    setUserTimezone("Europe/Helsinki");
    expect(isoToday()).toBe("2026-03-20");
  });

  it("returns correct date when user timezone is behind UTC", () => {
    // 03:00 UTC on March 20 = 22:00 on March 19 in America/New_York (UTC-5)
    vi.setSystemTime(new Date(Date.UTC(2026, 2, 20, 3, 0)));
    setUserTimezone("America/New_York");
    expect(isoToday()).toBe("2026-03-19");
  });
});

// ─── timezone-aware getCurrentMonth ─────────────────────────────────────────

describe("timezone-aware getCurrentMonth", () => {
  it("returns correct month when timezone crosses month boundary", () => {
    // March 31 23:00 UTC = April 1 01:00 in Europe/Helsinki (UTC+2 in winter, UTC+3 in summer)
    // In March, Helsinki is UTC+2, so 23:00 UTC = 01:00 April 1
    vi.setSystemTime(new Date(Date.UTC(2026, 2, 31, 23, 0)));
    setUserTimezone("Europe/Helsinki");
    expect(getCurrentMonth()).toBe("2026-04");
  });

  it("uses UTC when no timezone configured", () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 2, 31, 23, 0)));
    expect(getCurrentMonth()).toBe("2026-03");
  });
});

// ─── timezone-aware computePresetRange ──────────────────────────────────────

describe("timezone-aware computePresetRange", () => {
  it("this-month uses timezone-aware current month", () => {
    // March 31 23:00 UTC = April 1 in Helsinki → "this-month" should be April
    vi.setSystemTime(new Date(Date.UTC(2026, 2, 31, 23, 0)));
    setUserTimezone("Europe/Helsinki");
    const range = computePresetRange("this-month");
    expect(range.dateFrom).toBe("2026-04-01");
    expect(range.dateTo).toBe("2026-04-30");
  });
});

// ─── offsetDate ──────────────────────────────────────────────────────────────

describe("offsetDate", () => {
  it("adds positive days", () => {
    expect(offsetDate("2026-03-19", 5)).toBe("2026-03-24");
  });

  it("subtracts days", () => {
    expect(offsetDate("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("crosses year boundaries", () => {
    expect(offsetDate("2025-12-31", 1)).toBe("2026-01-01");
  });
});

// ─── daysBetween ─────────────────────────────────────────────────────────────

describe("daysBetween", () => {
  it("returns 0 for the same date", () => {
    expect(daysBetween("2026-03-19", "2026-03-19")).toBe(0);
  });

  it("returns positive count for chronological dates", () => {
    expect(daysBetween("2026-03-01", "2026-03-10")).toBe(9);
  });

  it("returns negative for reversed dates", () => {
    expect(daysBetween("2026-03-10", "2026-03-01")).toBe(-9);
  });
});

// ─── isoDateFromMs ───────────────────────────────────────────────────────────

describe("isoDateFromMs", () => {
  it("converts a Unix timestamp in ms to YYYY-MM-DD", () => {
    const ms = Date.UTC(2026, 2, 19, 14, 30);
    expect(isoDateFromMs(ms)).toBe("2026-03-19");
  });
});
