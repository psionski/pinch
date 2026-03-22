"use client";

import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Temporal } from "@js-temporal/polyfill";

interface PricePoint {
  pricePerUnit: number;
  recordedAt: string;
}

interface PriceChartProps {
  data: PricePoint[];
  currency: string;
}

const chartConfig = {
  price: {
    label: "Price",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

function formatDate(dateStr: string): string {
  return Temporal.PlainDate.from(dateStr.slice(0, 10)).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function PriceChart({ data, currency }: PriceChartProps): React.ReactElement {
  if (data.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Price History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground py-10 text-center text-sm">Not enough price data.</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((point) => ({
    date: point.recordedAt,
    price: point.pricePerUnit / 100,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Price History</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
          <LineChart data={chartData} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={formatDate}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => `${currency} ${value}`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(label) => formatDate(label as string)}
                  formatter={(value) => `${currency} ${(value as number).toFixed(2)}`}
                />
              }
            />
            <Line
              dataKey="price"
              type="monotone"
              stroke="var(--color-price)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
