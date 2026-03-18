"use client";

import { Pie, PieChart, Cell } from "recharts";
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

interface CategoryDonutChartProps {
  data: CategoryStatsItem[];
}

export function CategoryDonutChart({ data }: CategoryDonutChartProps): React.ReactElement {
  let fallbackIndex = 0;
  const chartData = data.map((item) => {
    const color = item.color ?? FALLBACK_COLORS[fallbackIndex++ % FALLBACK_COLORS.length];
    return {
      name: item.categoryName ?? "Uncategorized",
      value: item.total / 100,
      percentage: item.percentage,
      color,
    };
  });

  const chartConfig = Object.fromEntries(
    chartData.map((item) => [
      item.name,
      {
        label: item.name,
        color: item.color,
      },
    ])
  ) satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending by Category</CardTitle>
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
              >
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
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
