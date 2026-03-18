"use client";

import { useState, useEffect } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMonth } from "@/lib/format";
import type { BudgetHistoryPoint } from "@/lib/validators/budgets";

const chartConfig = {
  budget: {
    label: "Budget",
    color: "var(--chart-1)",
  },
  spent: {
    label: "Spent",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export function BudgetAdherenceChart(): React.ReactElement {
  const [data, setData] = useState<BudgetHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory(): Promise<void> {
      try {
        const res = await fetch("/api/budgets/history?months=6");
        if (res.ok) {
          setData((await res.json()) as BudgetHistoryPoint[]);
        }
      } finally {
        setLoading(false);
      }
    }
    void fetchHistory();
  }, []);

  const chartData = data.map((point) => ({
    month: formatMonth(point.month),
    budget: point.totalBudget / 100,
    spent: point.totalSpent / 100,
  }));

  const hasData = chartData.some((d) => d.budget > 0 || d.spent > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Budget Adherence</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground py-10 text-center text-sm">Loading...</p>
        ) : hasData ? (
          <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
            <BarChart data={chartData} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => `€${value}`}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) =>
                      `€${(value as number).toLocaleString("de-DE", { minimumFractionDigits: 2 })}`
                    }
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="budget" fill="var(--color-budget)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="spent" fill="var(--color-spent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        ) : (
          <p className="text-muted-foreground py-10 text-center text-sm">No budget history yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
