"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import type { AssetPerformanceItem } from "@/lib/validators/portfolio-reports";

type SortKey = keyof Pick<
  AssetPerformanceItem,
  "name" | "costBasis" | "currentValue" | "pnl" | "pnlPct" | "annualizedReturn" | "daysHeld"
>;

type SortDir = "asc" | "desc";

interface PerformanceTableProps {
  data: AssetPerformanceItem[];
}

function formatPct(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

function formatPnlCurrency(cents: number): string {
  const sign = cents >= 0 ? "+" : "";
  return `${sign}${formatCurrency(cents)}`;
}

function pnlColor(value: number): string {
  if (value > 0) return "text-emerald-600";
  if (value < 0) return "text-destructive";
  return "";
}

function sortItems(
  items: AssetPerformanceItem[],
  key: SortKey,
  dir: SortDir
): AssetPerformanceItem[] {
  return [...items].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];

    // nulls sort last regardless of direction
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;

    let cmp: number;
    if (typeof aVal === "string" && typeof bVal === "string") {
      cmp = aVal.localeCompare(bVal);
    } else {
      cmp = (aVal as number) - (bVal as number);
    }

    return dir === "asc" ? cmp : -cmp;
  });
}

interface ColumnDef {
  key: SortKey;
  label: string;
  hideOnMobile?: boolean;
  align?: "left" | "right";
}

const COLUMNS: ColumnDef[] = [
  { key: "name", label: "Asset", align: "left" },
  { key: "costBasis", label: "Cost Basis", align: "right" },
  { key: "currentValue", label: "Current Value", align: "right" },
  { key: "pnl", label: "P&L (\u20ac)", align: "right" },
  { key: "pnlPct", label: "P&L (%)", align: "right" },
  { key: "annualizedReturn", label: "Ann. Return", align: "right", hideOnMobile: true },
  { key: "daysHeld", label: "Days Held", align: "right", hideOnMobile: true },
];

export function PerformanceTable({ data }: PerformanceTableProps): React.JSX.Element {
  const [sortKey, setSortKey] = useState<SortKey>("pnl");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey): void {
    if (key === sortKey) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = sortItems(data, sortKey, sortDir);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No asset performance data available.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className={`text-muted-foreground cursor-pointer text-xs font-medium select-none ${
                        col.align === "right" ? "text-right" : "text-left"
                      } ${col.hideOnMobile ? "hidden md:table-cell" : ""} px-2 py-2`}
                      onClick={() => handleSort(col.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        <ArrowUpDown
                          className={`h-3 w-3 ${sortKey === col.key ? "opacity-100" : "opacity-0"}`}
                        />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((item) => (
                  <tr key={item.assetId} className="border-b">
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/assets/${item.assetId}`}
                          className="text-foreground font-medium hover:underline"
                        >
                          {item.name}
                        </Link>
                        <Badge variant="secondary">{item.type}</Badge>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right">{formatCurrency(item.costBasis)}</td>
                    <td className="px-2 py-2 text-right">{formatCurrency(item.currentValue)}</td>
                    <td className={`px-2 py-2 text-right font-medium ${pnlColor(item.pnl)}`}>
                      {formatPnlCurrency(item.pnl)}
                    </td>
                    <td className={`px-2 py-2 text-right font-medium ${pnlColor(item.pnlPct)}`}>
                      {formatPct(item.pnlPct)}
                    </td>
                    <td
                      className={`hidden px-2 py-2 text-right md:table-cell ${
                        item.annualizedReturn !== null ? pnlColor(item.annualizedReturn) : ""
                      }`}
                    >
                      {item.annualizedReturn !== null ? formatPct(item.annualizedReturn) : "\u2014"}
                    </td>
                    <td className="hidden px-2 py-2 text-right md:table-cell">{item.daysHeld}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
