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
  return d.toISOString().slice(0, 10);
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

/** Compute the previous period of the same length for comparison. */
export function computeCompareRange(range: DateRange): ComputedRange {
  const from = new Date(range.dateFrom);
  const to = new Date(range.dateTo);
  const durationMs = to.getTime() - from.getTime();
  const compareEnd = new Date(from.getTime() - 1);
  const compareStart = new Date(compareEnd.getTime() - durationMs);

  const months = Math.max(1, Math.round(durationMs / (30.44 * 24 * 60 * 60 * 1000)));

  return {
    ...range,
    compareDateFrom: toIsoDate(compareStart),
    compareDateTo: toIsoDate(compareEnd),
    months,
  };
}
