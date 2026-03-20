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

/** Returns the current month as YYYY-MM. */
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export interface MonthInfo {
  currentMonth: string;
  monthStart: string;
  monthEnd: string;
  monthLabel: string;
}

/** Returns the current month string, start/end dates, and a human-readable label. */
export function getCurrentMonthInfo(): MonthInfo {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentMonth = `${year}-${String(month).padStart(2, "0")}`;
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
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

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
