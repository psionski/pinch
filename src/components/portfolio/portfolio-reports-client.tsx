"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { NetWorthChart } from "./net-worth-chart";
import { AllocationChart } from "./allocation-chart";
import { PerformanceTable } from "./performance-table";
import { CurrencyExposure } from "./currency-exposure";
import { PnlSummary } from "./pnl-summary";
import { TransferFlow } from "./transfer-flow";
import type { NetWorthPoint } from "@/lib/validators/portfolio-reports";
import type { AssetPerformanceItem } from "@/lib/validators/portfolio-reports";
import type { AllocationResult } from "@/lib/validators/portfolio-reports";
import type { CurrencyExposureItem } from "@/lib/validators/portfolio-reports";
import type { RealizedPnlResult } from "@/lib/validators/portfolio-reports";
import type { TransferSummaryItem } from "@/lib/validators/portfolio-reports";

const WINDOWS = ["3m", "6m", "12m", "ytd", "all"] as const;
type Window = (typeof WINDOWS)[number];

export interface PortfolioReportsData {
  netWorth: NetWorthPoint[];
  performance: AssetPerformanceItem[];
  allocation: AllocationResult;
  currencyExposure: CurrencyExposureItem[];
  realizedPnl: RealizedPnlResult;
  transferSummary: TransferSummaryItem[];
  unrealizedPnl: number | null;
}

interface PortfolioReportsClientProps {
  initialData: PortfolioReportsData;
  initialWindow: Window;
  currentMonth: string;
}

export function PortfolioReportsClient({
  initialData,
  initialWindow,
  currentMonth,
}: PortfolioReportsClientProps): React.ReactElement {
  const [data, setData] = useState(initialData);
  const [window, setWindow] = useState<Window>(initialWindow);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(
    async (w: Window): Promise<void> => {
      setLoading(true);
      try {
        const [netWorthRes, perfRes, allocRes, currRes, pnlRes, transferRes] = await Promise.all([
          fetch(`/api/portfolio/net-worth?window=${w}&interval=monthly`),
          fetch("/api/portfolio/performance"),
          fetch("/api/portfolio/allocation"),
          fetch("/api/portfolio/currency-exposure"),
          fetch("/api/portfolio/realized-pnl"),
          fetch(`/api/portfolio/transfer-summary?month=${currentMonth}`),
        ]);

        if (
          netWorthRes.ok &&
          perfRes.ok &&
          allocRes.ok &&
          currRes.ok &&
          pnlRes.ok &&
          transferRes.ok
        ) {
          const [
            netWorth,
            performance,
            allocation,
            currencyExposure,
            realizedPnl,
            transferSummary,
          ] = await Promise.all([
            netWorthRes.json() as Promise<NetWorthPoint[]>,
            perfRes.json() as Promise<AssetPerformanceItem[]>,
            allocRes.json() as Promise<AllocationResult>,
            currRes.json() as Promise<CurrencyExposureItem[]>,
            pnlRes.json() as Promise<RealizedPnlResult>,
            transferRes.json() as Promise<TransferSummaryItem[]>,
          ]);

          // Compute unrealized P&L from performance data
          const totalCostBasis = performance.reduce((s, p) => s + p.costBasis, 0);
          const totalCurrentValue = performance.reduce((s, p) => s + p.currentValue, 0);
          const unrealizedPnl = totalCurrentValue - totalCostBasis;

          setData({
            netWorth,
            performance,
            allocation,
            currencyExposure,
            realizedPnl,
            transferSummary,
            unrealizedPnl,
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [currentMonth]
  );

  function handleWindowChange(w: Window): void {
    setWindow(w);
    void fetchAll(w);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Portfolio Reports</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        {WINDOWS.map((w) => (
          <Button
            key={w}
            variant={window === w ? "default" : "outline"}
            size="sm"
            onClick={() => handleWindowChange(w)}
          >
            {w.toUpperCase()}
          </Button>
        ))}
      </div>

      <div className={loading ? "pointer-events-none opacity-60" : ""}>
        <div className="space-y-6">
          <NetWorthChart data={data.netWorth} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <AllocationChart data={data.allocation} />
            <CurrencyExposure data={data.currencyExposure} />
          </div>

          <PerformanceTable data={data.performance} />

          <PnlSummary realizedPnl={data.realizedPnl} unrealizedPnl={data.unrealizedPnl} />

          <TransferFlow data={data.transferSummary} />
        </div>
      </div>
    </div>
  );
}
