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
import type { CategoryBreakdownItem } from "@/lib/validators/reports";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

interface CategoryDonutChartProps {
  data: CategoryBreakdownItem[];
}

export function CategoryDonutChart({ data }: CategoryDonutChartProps): React.ReactElement {
  const chartData = data.map((item) => ({
    name: item.categoryName ?? "Uncategorized",
    value: item.total / 100,
    percentage: item.percentage,
  }));

  const chartConfig = Object.fromEntries(
    chartData.map((item, i) => [
      item.name,
      {
        label: item.name,
        color: COLORS[i % COLORS.length],
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
                {chartData.map((_, i) => (
                  <Cell key={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} />
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
