"use client";

import { useState, useCallback } from "react";
import { Plus, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AssetFormDialog } from "./asset-form-dialog";
import { BuySellDialog } from "./buy-sell-dialog";
import { DepositWithdrawDialog } from "./deposit-withdraw-dialog";
import { RecordPriceDialog } from "./record-price-dialog";
import { AllocationChart } from "@/components/portfolio/allocation-chart";
import { CurrencyExposure } from "@/components/portfolio/currency-exposure";
import { PerformanceTable } from "@/components/portfolio/performance-table";
import { formatCurrency } from "@/lib/format";
import type { AssetWithMetrics, PortfolioResponse } from "@/lib/validators/assets";
import type {
  AssetPerformanceItem,
  AllocationResult,
  CurrencyExposureItem,
} from "@/lib/validators/portfolio-reports";

interface AssetsClientProps {
  initialAssets: AssetWithMetrics[];
  portfolio: PortfolioResponse;
  performance: AssetPerformanceItem[];
  allocation: AllocationResult;
  currencyExposure: CurrencyExposureItem[];
}

const TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  investment: "Investment",
  crypto: "Crypto",
  other: "Other",
};

function PnlBadge({ pnl }: { pnl: number | null }): React.ReactElement | null {
  if (pnl === null) return null;
  const positive = pnl >= 0;
  return (
    <span
      className={`flex items-center gap-1 text-sm font-medium ${positive ? "text-emerald-600" : "text-destructive"}`}
    >
      {positive ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
      {positive ? "+" : ""}
      {formatCurrency(pnl)}
    </span>
  );
}

function SummaryCards({ portfolio }: { portfolio: PortfolioResponse }): React.ReactElement {
  const { netWorth, cashBalance, totalAssetValue, pnl } = portfolio;
  const totalInvested = portfolio.assets.reduce((s, a) => s + a.costBasis, 0);
  const pnlPct = totalInvested > 0 && pnl !== null ? (pnl / totalInvested) * 100 : null;

  return (
    <div data-tour="asset-summary" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-muted-foreground text-xs font-medium uppercase">
            Net Worth
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-bold">{formatCurrency(netWorth)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-muted-foreground text-xs font-medium uppercase">
            Cash Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-bold">{formatCurrency(cashBalance)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-muted-foreground text-xs font-medium uppercase">
            Total Invested
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xl font-bold">{formatCurrency(totalInvested)}</p>
          <p className="text-muted-foreground text-xs">Value: {formatCurrency(totalAssetValue)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-muted-foreground text-xs font-medium uppercase">
            Total P&amp;L
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pnl !== null ? (
            <>
              <p
                className={`flex items-center gap-1 text-xl font-bold ${pnl >= 0 ? "text-emerald-600" : "text-destructive"}`}
              >
                {pnl >= 0 ? <TrendingUp className="size-5" /> : <TrendingDown className="size-5" />}
                {pnl >= 0 ? "+" : ""}
                {formatCurrency(pnl)}
              </p>
              {pnlPct !== null && (
                <p className="text-muted-foreground text-xs">
                  {pnlPct >= 0 ? "+" : ""}
                  {pnlPct.toFixed(1)}%
                </p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-xl">—</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function AssetsClient({
  initialAssets,
  portfolio,
  performance,
  allocation,
  currencyExposure,
}: AssetsClientProps): React.ReactElement {
  const [assets, setAssets] = useState(initialAssets);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [buyingAsset, setBuyingAsset] = useState<AssetWithMetrics | null>(null);
  const [sellingAsset, setSellingAsset] = useState<AssetWithMetrics | null>(null);
  const [depositingAsset, setDepositingAsset] = useState<AssetWithMetrics | null>(null);
  const [withdrawingAsset, setWithdrawingAsset] = useState<AssetWithMetrics | null>(null);
  const [pricingAsset, setPricingAsset] = useState<AssetWithMetrics | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch("/api/assets");
      if (res.ok) setAssets((await res.json()) as AssetWithMetrics[]);
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleCreate(data: {
    name: string;
    type: "deposit" | "investment" | "crypto" | "other";
    currency: string;
    icon?: string;
  }): Promise<void> {
    setLoading(true);
    try {
      await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setShowCreate(false);
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleBuy(
    asset: AssetWithMetrics,
    data: { quantity: number; pricePerUnit: number; date: string; description?: string },
    closeDialog: () => void
  ): Promise<void> {
    setLoading(true);
    try {
      await fetch(`/api/assets/${asset.id}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      closeDialog();
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleSell(
    asset: AssetWithMetrics,
    data: { quantity: number; pricePerUnit: number; date: string; description?: string },
    closeDialog: () => void
  ): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch(`/api/assets/${asset.id}/sell`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        alert(err.error);
        return;
      }
      closeDialog();
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleRecordPrice(
    asset: AssetWithMetrics,
    data: { pricePerUnit: number; recordedAt?: string }
  ): Promise<void> {
    setLoading(true);
    try {
      await fetch(`/api/assets/${asset.id}/prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setPricingAsset(null);
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`space-y-6 ${loading ? "pointer-events-none opacity-60" : ""}`}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Assets</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 size-4" />
          Add Asset
        </Button>
      </div>

      {assets.length === 0 ? (
        <p className="text-muted-foreground">
          No assets yet. Add a savings account, investment, or crypto holding to track your net
          worth.
        </p>
      ) : (
        <>
          <SummaryCards portfolio={portfolio} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <AllocationChart data={allocation} />
            <CurrencyExposure data={currencyExposure} />
          </div>

          <PerformanceTable data={performance} />

          <div
            data-tour="asset-cards"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {assets.map((asset) => (
              <Card key={asset.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        {asset.icon && <span className="text-lg">{asset.icon}</span>}
                        <CardTitle className="text-base">{asset.name}</CardTitle>
                      </div>
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {TYPE_LABELS[asset.type] ?? asset.type}
                      </Badge>
                    </div>
                    <Link href={`/assets/${asset.id}`} data-testid={`asset-link-${asset.id}`}>
                      <Button variant="ghost" size="icon" className="size-7">
                        <ArrowRight className="size-4" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1 text-sm">
                    <div className="text-muted-foreground flex justify-between">
                      <span>Holdings</span>
                      <span className="font-mono">
                        {asset.currentHoldings}{" "}
                        {asset.type === "deposit" ? asset.currency : asset.name}
                      </span>
                    </div>
                    <div className="text-muted-foreground flex justify-between">
                      <span>Cost basis</span>
                      <span className="font-mono">{formatCurrency(asset.costBasis)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current value</span>
                      <span className="font-mono font-medium">
                        {asset.currentValue !== null ? formatCurrency(asset.currentValue) : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">P&amp;L</span>
                      <PnlBadge pnl={asset.pnl} />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    {asset.type === "deposit" ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setDepositingAsset(asset)}
                        >
                          Deposit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setWithdrawingAsset(asset)}
                        >
                          Withdraw
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setBuyingAsset(asset)}
                        >
                          Buy
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setSellingAsset(asset)}
                        >
                          Sell
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setPricingAsset(asset)}>
                      Set Price
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {showCreate && (
        <AssetFormDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          onSubmit={handleCreate}
          loading={loading}
        />
      )}

      {buyingAsset && (
        <BuySellDialog
          open={!!buyingAsset}
          onOpenChange={(o) => {
            if (!o) setBuyingAsset(null);
          }}
          mode="buy"
          asset={buyingAsset}
          onSubmit={(data) => void handleBuy(buyingAsset, data, () => setBuyingAsset(null))}
          loading={loading}
        />
      )}

      {sellingAsset && (
        <BuySellDialog
          open={!!sellingAsset}
          onOpenChange={(o) => {
            if (!o) setSellingAsset(null);
          }}
          mode="sell"
          asset={sellingAsset}
          onSubmit={(data) => void handleSell(sellingAsset, data, () => setSellingAsset(null))}
          loading={loading}
        />
      )}

      {depositingAsset && (
        <DepositWithdrawDialog
          open={!!depositingAsset}
          onOpenChange={(o) => {
            if (!o) setDepositingAsset(null);
          }}
          mode="deposit"
          asset={depositingAsset}
          onSubmit={(data) => void handleBuy(depositingAsset, data, () => setDepositingAsset(null))}
          loading={loading}
        />
      )}

      {withdrawingAsset && (
        <DepositWithdrawDialog
          open={!!withdrawingAsset}
          onOpenChange={(o) => {
            if (!o) setWithdrawingAsset(null);
          }}
          mode="withdraw"
          asset={withdrawingAsset}
          onSubmit={(data) =>
            void handleSell(withdrawingAsset, data, () => setWithdrawingAsset(null))
          }
          loading={loading}
        />
      )}

      {pricingAsset && (
        <RecordPriceDialog
          open={!!pricingAsset}
          onOpenChange={(o) => {
            if (!o) setPricingAsset(null);
          }}
          asset={pricingAsset}
          onSubmit={(data) => void handleRecordPrice(pricingAsset, data)}
          loading={loading}
        />
      )}
    </div>
  );
}
