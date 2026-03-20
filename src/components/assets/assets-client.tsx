"use client";

import { useState, useCallback } from "react";
import { Plus, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AssetFormDialog } from "./asset-form-dialog";
import { BuySellDialog } from "./buy-sell-dialog";
import { RecordPriceDialog } from "./record-price-dialog";
import { formatCurrency } from "@/lib/format";
import type { AssetWithMetrics } from "@/lib/validators/assets";

interface AssetsClientProps {
  initialAssets: AssetWithMetrics[];
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

export function AssetsClient({ initialAssets }: AssetsClientProps): React.ReactElement {
  const [assets, setAssets] = useState(initialAssets);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [buyingAsset, setBuyingAsset] = useState<AssetWithMetrics | null>(null);
  const [sellingAsset, setSellingAsset] = useState<AssetWithMetrics | null>(null);
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
    data: { quantity: number; pricePerUnit: number; date: string; description?: string }
  ): Promise<void> {
    setLoading(true);
    try {
      await fetch(`/api/assets/${asset.id}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setBuyingAsset(null);
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleSell(
    asset: AssetWithMetrics,
    data: { quantity: number; pricePerUnit: number; date: string; description?: string }
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
      setSellingAsset(null);
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleRecordPrice(
    asset: AssetWithMetrics,
    data: { pricePerUnit: number }
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  <Link href={`/assets/${asset.id}`}>
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
                  <Button size="sm" variant="outline" onClick={() => setPricingAsset(asset)}>
                    Price
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AssetFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSubmit={handleCreate}
        loading={loading}
      />

      {buyingAsset && (
        <BuySellDialog
          open={!!buyingAsset}
          onOpenChange={(o) => {
            if (!o) setBuyingAsset(null);
          }}
          mode="buy"
          asset={buyingAsset}
          onSubmit={(data) => void handleBuy(buyingAsset, data)}
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
          onSubmit={(data) => void handleSell(sellingAsset, data)}
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
