"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_PRESET,
  PRESET_LABELS,
  computePresetRange,
  computeCompareRange,
  type Preset,
  type ComputedRange,
} from "@/lib/date-ranges";

interface DateRangeFilterProps {
  onChange: (range: ComputedRange) => void;
}

export function DateRangeFilter({ onChange }: DateRangeFilterProps): React.ReactElement {
  const [activePreset, setActivePreset] = useState<Preset>(DEFAULT_PRESET);
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
      const [toYear, toMonth] = to.split("-").map(Number);
      const lastDay = new Date(toYear, toMonth, 0).getDate();
      onChange(
        computeCompareRange({
          dateFrom: `${from}-01`,
          dateTo: `${to}-${String(lastDay).padStart(2, "0")}`,
        })
      );
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
            type="month"
            value={customFrom}
            onChange={(e) => {
              setCustomFrom(e.target.value);
              handleCustomChange(e.target.value, customTo);
            }}
            className="h-8 w-[150px]"
          />
          <span className="text-muted-foreground">to</span>
          <Input
            type="month"
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
