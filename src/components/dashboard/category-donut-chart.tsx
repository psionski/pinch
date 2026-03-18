"use client";

import { useState, useMemo, useCallback } from "react";
import { Pie, PieChart, Cell } from "recharts";
import { ChevronRight } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CategoryStatsItem } from "@/lib/validators/reports";

const FALLBACK_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

interface BreadcrumbEntry {
  id: number | null;
  name: string;
}

interface CategoryDonutChartProps {
  data: CategoryStatsItem[];
  monthLabel: string;
}

interface ChartEntry {
  name: string;
  value: number;
  percentage: number;
  color: string;
  categoryId: number | null;
  hasChildren: boolean;
}

export function CategoryDonutChart({
  data,
  monthLabel,
}: CategoryDonutChartProps): React.ReactElement {
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>([{ id: null, name: "All" }]);
  const currentParentId = breadcrumb[breadcrumb.length - 1].id;

  // Build a set of category IDs that have children in the dataset
  const parentIds = useMemo(() => {
    const set = new Set<number>();
    for (const item of data) {
      if (item.parentId !== null) set.add(item.parentId);
    }
    return set;
  }, [data]);

  const chartData = useMemo((): ChartEntry[] => {
    // Filter to items at the current hierarchy level
    const levelItems = data.filter((item) => item.parentId === currentParentId);

    // When drilled in, check if the parent has direct spend not covered by children
    const entries: Array<{
      name: string;
      rawValue: number;
      color: string | null;
      categoryId: number | null;
      hasChildren: boolean;
    }> = [];

    if (currentParentId !== null) {
      const parent = data.find((item) => item.categoryId === currentParentId);
      if (parent && parent.total > 0) {
        entries.push({
          name: `Direct`,
          rawValue: parent.total,
          color: null,
          categoryId: null,
          hasChildren: false,
        });
      }
    }

    for (const item of levelItems) {
      const hasChildren = item.categoryId !== null && parentIds.has(item.categoryId);
      entries.push({
        name: item.categoryName ?? "Uncategorized",
        rawValue: hasChildren ? item.rollupTotal : item.total,
        color: item.color,
        categoryId: item.categoryId,
        hasChildren,
      });
    }

    // Compute percentages from this level's total
    const grandTotal = entries.reduce((s, e) => s + e.rawValue, 0);
    let fallbackIndex = 0;

    return entries
      .filter((e) => e.rawValue > 0)
      .map((entry) => ({
        name: entry.name,
        value: entry.rawValue / 100,
        percentage: grandTotal > 0 ? Math.round((entry.rawValue / grandTotal) * 10000) / 100 : 0,
        color: entry.color ?? FALLBACK_COLORS[fallbackIndex++ % FALLBACK_COLORS.length],
        categoryId: entry.categoryId,
        hasChildren: entry.hasChildren,
      }));
  }, [data, currentParentId, parentIds]);

  const chartConfig = useMemo(
    () =>
      Object.fromEntries(
        chartData.map((item) => [item.name, { label: item.name, color: item.color }])
      ) satisfies ChartConfig,
    [chartData]
  );

  const handleClick = useCallback(
    (_: unknown, index: number) => {
      const entry = chartData[index];
      if (!entry?.hasChildren || entry.categoryId === null) return;
      setBreadcrumb((prev) => [...prev, { id: entry.categoryId!, name: entry.name }]);
    },
    [chartData]
  );

  function handleBreadcrumbClick(index: number): void {
    setBreadcrumb((prev) => prev.slice(0, index + 1));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending by Category &mdash; {monthLabel}</CardTitle>
        {breadcrumb.length > 1 && (
          <nav className="text-muted-foreground flex items-center gap-0.5 text-sm">
            {breadcrumb.map((entry, i) => (
              <span key={entry.id ?? "root"} className="flex items-center gap-0.5">
                {i > 0 && <ChevronRight className="size-3" />}
                <button
                  onClick={() => handleBreadcrumbClick(i)}
                  className={
                    i === breadcrumb.length - 1
                      ? "text-foreground font-medium"
                      : "hover:text-foreground underline-offset-2 hover:underline"
                  }
                >
                  {entry.name}
                </button>
              </span>
            ))}
          </nav>
        )}
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ChartContainer config={chartConfig} className="mx-auto min-h-[250px] w-full max-w-xs">
            <PieChart accessibilityLayer>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) =>
                      `€${(value as number).toLocaleString("de-DE", { minimumFractionDigits: 2 })}`
                    }
                  />
                }
              />
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={90}
                strokeWidth={2}
                onClick={handleClick}
                style={{ cursor: "pointer" }}
              >
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.color}
                    style={{ cursor: entry.hasChildren ? "pointer" : "default" }}
                  />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          </ChartContainer>
        ) : (
          <p className="text-muted-foreground py-10 text-center text-sm">No category data yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
