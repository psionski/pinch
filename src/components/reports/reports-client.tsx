"use client";

import { useState, useCallback } from "react";
import { DateRangeFilter } from "./date-range-filter";
import { computeCompareRange, type ComputedRange, type DateRange } from "@/lib/date-ranges";
import { IncomeExpensesCard } from "./income-expenses-card";
import { SavingsRateChart } from "@/components/charts/savings-rate-chart";
import { TrendsChart } from "@/components/charts/trends-chart";
import { CategoryChangesCard } from "./category-changes-card";
import { MerchantTable } from "./merchant-table";
import type {
  NetBalanceResult,
  TrendPoint,
  SpendingSummaryResult,
  TopMerchant,
} from "@/lib/validators/reports";
import type { CategoryWithCountResponse } from "@/lib/validators/categories";

export interface ReportsData {
  balance: NetBalanceResult;
  incomeTrend: TrendPoint[];
  expenseTrend: TrendPoint[];
  spendingTrend: TrendPoint[];
  summary: SpendingSummaryResult;
  topMerchants: TopMerchant[];
}

interface ReportsClientProps {
  initialData: ReportsData;
  initialDateRange: DateRange;
  categories: CategoryWithCountResponse[];
}

export function ReportsClient({
  initialData,
  initialDateRange,
  categories,
}: ReportsClientProps): React.ReactElement {
  const [data, setData] = useState<ReportsData>(initialData);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<ComputedRange>(computeCompareRange(initialDateRange));
  const isLongRange = range.months >= 3;

  const fetchAll = useCallback(async (r: ComputedRange): Promise<void> => {
    setLoading(true);
    try {
      const params = (extra: Record<string, string>): string =>
        new URLSearchParams(extra).toString();

      const [balanceRes, incomeTrendRes, expenseTrendRes, summaryRes, merchantsRes] =
        await Promise.all([
          fetch(`/api/reports/balance?${params({ dateFrom: r.dateFrom, dateTo: r.dateTo })}`),
          fetch(`/api/reports/trends?${params({ months: String(r.months), type: "income" })}`),
          fetch(`/api/reports/trends?${params({ months: String(r.months), type: "expense" })}`),
          fetch(
            `/api/reports/summary?${params({
              dateFrom: r.dateFrom,
              dateTo: r.dateTo,
              groupBy: "category",
              type: "expense",
              compareDateFrom: r.compareDateFrom,
              compareDateTo: r.compareDateTo,
            })}`
          ),
          fetch(
            `/api/reports/top-merchants?${params({
              dateFrom: r.dateFrom,
              dateTo: r.dateTo,
              type: "expense",
            })}`
          ),
        ]);

      if (
        balanceRes.ok &&
        incomeTrendRes.ok &&
        expenseTrendRes.ok &&
        summaryRes.ok &&
        merchantsRes.ok
      ) {
        const [balance, incomeTrend, expenseTrend, summary, topMerchants] = await Promise.all([
          balanceRes.json() as Promise<NetBalanceResult>,
          incomeTrendRes.json() as Promise<TrendPoint[]>,
          expenseTrendRes.json() as Promise<TrendPoint[]>,
          summaryRes.json() as Promise<SpendingSummaryResult>,
          merchantsRes.json() as Promise<TopMerchant[]>,
        ]);
        setData({
          balance,
          incomeTrend,
          expenseTrend,
          spendingTrend: expenseTrend,
          summary,
          topMerchants,
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  function handleRangeChange(newRange: ComputedRange): void {
    setRange(newRange);
    void fetchAll(newRange);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
      </div>

      <DateRangeFilter onChange={handleRangeChange} />

      <div className={loading ? "pointer-events-none opacity-60" : ""}>
        <div className="space-y-6">
          {/* Income vs Expenses — always show KPIs, chart only for 3+ months */}
          <IncomeExpensesCard
            balance={data.balance}
            incomeTrend={data.incomeTrend}
            expenseTrend={data.expenseTrend}
            showChart={isLongRange}
          />

          {/* Trend charts — only for 3+ months */}
          {isLongRange && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <SavingsRateChart incomeTrend={data.incomeTrend} expenseTrend={data.expenseTrend} />
              <TrendsChart
                data={data.spendingTrend}
                categories={categories}
                months={range.months}
              />
            </div>
          )}

          {/* Category Changes — only for 1-2 months */}
          {!isLongRange && <CategoryChangesCard groups={data.summary.groups} />}

          {/* Merchant Table — always */}
          <MerchantTable data={data.topMerchants} />
        </div>
      </div>
    </div>
  );
}
