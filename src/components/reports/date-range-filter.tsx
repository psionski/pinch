"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface DateRange {
  dateFrom: string;
  dateTo: string;
}

interface ComputedRange extends DateRange {
  compareDateFrom: string;
  compareDateTo: string;
  /** Approximate number of months the range spans (for trends API) */
  months: number;
}

type Preset = "this-month" | "last-month" | "3m" | "6m" | "12m" | "ytd" | "custom";

const PRESET_LABELS: Record<Preset, string> = {
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

function computePresetRange(preset: Exclude<Preset, "custom">): DateRange {
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

/** Compute the previous period of the same length, plus approximate month count. */
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

interface DateRangeFilterProps {
  onChange: (range: ComputedRange) => void;
}

export function DateRangeFilter({ onChange }: DateRangeFilterProps): React.ReactElement {
  const [activePreset, setActivePreset] = useState<Preset>("this-month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const presets = useMemo(() => Object.keys(PRESET_LABELS) as Preset[], []);

  function handlePreset(preset: Preset): void {
    setActivePreset(preset);
    if (preset !== "custom") {
      const range = computePresetRange(preset);
      onChange(computeCompareRange(range));
    }
  }

  function handleCustomChange(from: string, to: string): void {
    if (from && to && from <= to) {
      onChange(computeCompareRange({ dateFrom: from, dateTo: to }));
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <Button
            key={preset}
            variant={activePreset === preset ? "default" : "outline"}
            size="sm"
            onClick={() => handlePreset(preset)}
          >
            {PRESET_LABELS[preset]}
          </Button>
        ))}
      </div>

      {activePreset === "custom" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">From:</span>
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => {
              setCustomFrom(e.target.value);
              handleCustomChange(e.target.value, customTo);
            }}
            className="h-8 w-[150px]"
          />
          <span className="text-muted-foreground">to</span>
          <Input
            type="date"
            value={customTo}
            onChange={(e) => {
              setCustomTo(e.target.value);
              handleCustomChange(customFrom, e.target.value);
            }}
            className="h-8 w-[150px]"
          />
        </div>
      )}
    </div>
  );
}

export type { ComputedRange };
