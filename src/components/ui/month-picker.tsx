"use client";

import { useState } from "react";
import { getCurrentMonth } from "@/lib/date-ranges";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatMonth } from "@/lib/format";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

interface MonthPickerProps {
  /** Selected value in YYYY-MM format */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function MonthPicker({
  value,
  onChange,
  placeholder = "Select month",
}: MonthPickerProps): React.ReactElement {
  const [open, setOpen] = useState(false);

  // Display year defaults to selected value's year, or current year
  const initialYear = value ? Number(value.split("-")[0]) : Number(getCurrentMonth().split("-")[0]);
  const [displayYear, setDisplayYear] = useState(initialYear);

  const selectedYear = value ? Number(value.split("-")[0]) : null;
  const selectedMonth = value ? Number(value.split("-")[1]) : null;

  function handleSelect(monthIndex: number): void {
    const ym = `${displayYear}-${String(monthIndex + 1).padStart(2, "0")}`;
    onChange(ym);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-[130px] justify-start font-normal">
          <CalendarDays className="size-3.5" />
          {value ? (
            formatMonth(value)
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-2" align="start">
        {/* Year navigation */}
        <div className="flex items-center justify-between pb-1">
          <Button variant="ghost" size="icon-sm" onClick={() => setDisplayYear((y) => y - 1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-semibold">{displayYear}</span>
          <Button variant="ghost" size="icon-sm" onClick={() => setDisplayYear((y) => y + 1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {/* Month grid */}
        <div className="grid grid-cols-3 gap-1">
          {MONTH_LABELS.map((label, i) => {
            const isSelected = selectedYear === displayYear && selectedMonth === i + 1;
            const [nowYear, nowMonth] = getCurrentMonth().split("-").map(Number);
            const isCurrent = displayYear === nowYear && i + 1 === nowMonth && !isSelected;
            return (
              <Button
                key={label}
                variant={isSelected ? "default" : isCurrent ? "outline" : "ghost"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => handleSelect(i)}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
