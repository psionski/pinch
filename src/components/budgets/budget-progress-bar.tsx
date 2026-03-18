"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface BudgetProgressBarProps {
  percentUsed: number;
  className?: string;
}

function getProgressColor(percent: number): string {
  if (percent > 90) return "[&_[data-slot=progress-indicator]]:bg-destructive";
  if (percent >= 60) return "[&_[data-slot=progress-indicator]]:bg-yellow-500";
  return "[&_[data-slot=progress-indicator]]:bg-emerald-500";
}

export function BudgetProgressBar({
  percentUsed,
  className,
}: BudgetProgressBarProps): React.ReactElement {
  const displayValue = Math.min(percentUsed, 100);

  return (
    <Progress
      value={displayValue}
      className={cn("h-2", getProgressColor(percentUsed), className)}
    />
  );
}
