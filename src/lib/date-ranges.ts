import type { Window, Interval } from "@/lib/validators/portfolio-reports";

// ─── Timezone ─────────────────────────────────────────────────────────────────

let _tz: string | undefined;

/** Returns the cached timezone. Defaults to UTC until setUserTimezone() is called. */
function tz(): string {
  return _tz ?? "UTC";
}

/** Set the timezone used by all date functions. Called at server startup from settings DB. */
export function setUserTimezone(timezone: string): void {
  _tz = timezone;
}

/** Clear the cached timezone so it's re-read on next access. */
export function clearTimezoneCache(): void {
  _tz = undefined;
}

// ─── Today / Current Month ────────────────────────────────────────────────────

/** Today's date as YYYY-MM-DD in the user's configured timezone. */
export function isoToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: tz() });
}

export interface DateRange {
  dateFrom: string;
  dateTo: string;
}

export interface ComputedRange extends DateRange {
  compareDateFrom: string;
  compareDateTo: string;
  /** Approximate number of months the range spans (for trends API) */
  months: number;
}

export type Preset = "this-month" | "last-month" | "3m" | "6m" | "12m" | "ytd" | "custom";

export const DEFAULT_PRESET: Exclude<Preset, "custom"> = "6m";

export const PRESET_LABELS: Record<Preset, string> = {
  "this-month": "This Month",
  "last-month": "Last Month",
  "3m": "3 Months",
  "6m": "6 Months",
  "12m": "12 Months",
  ytd: "YTD",
  custom: "Custom",
};

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD without timezone issues (avoids UTC parsing of Date constructor). */
function parseIsoDate(s: string): { year: number; month: number } {
  const [y, m] = s.split("-").map(Number);
  return { year: y, month: m - 1 }; // month is 0-indexed like Date
}

/** Returns the current month as YYYY-MM in the user's configured timezone. */
export function getCurrentMonth(): string {
  return isoToday().slice(0, 7);
}

export interface MonthInfo {
  currentMonth: string;
  monthStart: string;
  monthEnd: string;
  monthLabel: string;
}

/** Returns the current month string, start/end dates, and a human-readable label. */
export function getCurrentMonthInfo(): MonthInfo {
  const currentMonth = getCurrentMonth();
  const [year, month] = currentMonth.split("-").map(Number);
  const monthStart = `${currentMonth}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${currentMonth}-${String(lastDay).padStart(2, "0")}`;
  const monthLabel = new Date(year, month - 1).toLocaleString("en", {
    month: "long",
    year: "numeric",
  });
  return { currentMonth, monthStart, monthEnd, monthLabel };
}

/** Returns the start/end dates for the month before the given YYYY-MM. */
export function getPreviousMonthRange(currentMonth: string): {
  prevMonthStart: string;
  prevMonthEnd: string;
} {
  const [year, month] = currentMonth.split("-").map(Number);
  const prevDate = new Date(year, month - 2, 1);
  const prevYear = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth() + 1;
  const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
  const prevMonthStart = `${prevMonthStr}-01`;
  const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();
  const prevMonthEnd = `${prevMonthStr}-${String(prevLastDay).padStart(2, "0")}`;
  return { prevMonthStart, prevMonthEnd };
}

export function computePresetRange(preset: Exclude<Preset, "custom">): DateRange {
  const [year, m] = getCurrentMonth().split("-").map(Number);
  const month = m - 1; // 0-indexed for Date math

  switch (preset) {
    case "this-month": {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      return { dateFrom: toIsoDate(start), dateTo: toIsoDate(end) };
    }
    case "last-month": {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      return { dateFrom: toIsoDate(start), dateTo: toIsoDate(end) };
    }
    case "3m": {
      const start = new Date(year, month - 2, 1);
      const end = new Date(year, month + 1, 0);
      return { dateFrom: toIsoDate(start), dateTo: toIsoDate(end) };
    }
    case "6m": {
      const start = new Date(year, month - 5, 1);
      const end = new Date(year, month + 1, 0);
      return { dateFrom: toIsoDate(start), dateTo: toIsoDate(end) };
    }
    case "12m": {
      const start = new Date(year, month - 11, 1);
      const end = new Date(year, month + 1, 0);
      return { dateFrom: toIsoDate(start), dateTo: toIsoDate(end) };
    }
    case "ytd": {
      const start = new Date(year, 0, 1);
      const end = new Date(year, month + 1, 0);
      return { dateFrom: toIsoDate(start), dateTo: toIsoDate(end) };
    }
  }
}

// ─── Shared Date Utilities ────────────────────────────────────────────────────

/** Offset a YYYY-MM-DD date string by a number of days. Returns YYYY-MM-DD (UTC). */
export function offsetDate(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Number of days between two YYYY-MM-DD dates (to - from). Same date returns 0. */
export function daysBetween(from: string, to: string): number {
  const a = new Date(from + "T00:00:00Z");
  const b = new Date(to + "T00:00:00Z");
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** Convert a Unix timestamp (milliseconds) to YYYY-MM-DD in UTC. */
export function isoDateFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// ─── Portfolio Date Utilities ─────────────────────────────────────────────────

/** Convert a portfolio window preset to a concrete date range. */
export function windowToDateRange(window: Window): { from: string; to: string } {
  const to = isoToday();
  const year = Number(to.slice(0, 4));

  if (window === "all") {
    return { from: "2000-01-01", to };
  }

  if (window === "ytd") {
    return { from: `${year}-01-01`, to };
  }

  const months = window === "3m" ? 3 : window === "6m" ? 6 : 12;
  const fromDate = new Date(to + "T00:00:00Z");
  fromDate.setUTCMonth(fromDate.getUTCMonth() - months);
  return { from: fromDate.toISOString().slice(0, 10), to };
}

/** Generate evenly-spaced date points between two dates at the given interval. */
export function generateDatePoints(from: string, to: string, interval: Interval): string[] {
  const points: string[] = [];
  const current = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");

  while (current <= end) {
    points.push(current.toISOString().slice(0, 10));

    if (interval === "daily") {
      current.setUTCDate(current.getUTCDate() + 1);
    } else if (interval === "weekly") {
      current.setUTCDate(current.getUTCDate() + 7);
    } else {
      current.setUTCMonth(current.getUTCMonth() + 1);
    }
  }

  // Always include the end date if not already there
  if (points.length === 0 || points[points.length - 1] !== to) {
    points.push(to);
  }

  return points;
}

// ─── Range Computation ────────────────────────────────────────────────────────

/** Compute the previous period of the same length (month-aligned) for comparison. */
export function computeCompareRange(range: DateRange): ComputedRange {
  const from = parseIsoDate(range.dateFrom);
  const to = parseIsoDate(range.dateTo);

  // Count months in range (first-of-month to last-of-month)
  const months = Math.max(1, (to.year - from.year) * 12 + (to.month - from.month) + 1);

  // Previous period: shift back by that many months, aligned to month boundaries
  const compareStart = new Date(from.year, from.month - months, 1);
  const compareEnd = new Date(from.year, from.month, 0); // last day before dateFrom's month

  return {
    ...range,
    compareDateFrom: toIsoDate(compareStart),
    compareDateTo: toIsoDate(compareEnd),
    months,
  };
}
