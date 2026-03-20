import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { getAssetService, getAssetLotService, getAssetPriceService } from "@/lib/api/services";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LotHistoryTable } from "@/components/assets/lot-history-table";
import { formatCurrency } from "@/lib/format";

interface PageProps {
  params: Promise<{ id: string }>;
}

function PnlDisplay({ pnl }: { pnl: number | null }): React.ReactElement {
  if (pnl === null) return <span className="text-muted-foreground">—</span>;
  const positive = pnl >= 0;
  return (
    <span
      className={`flex items-center gap-1 font-semibold ${positive ? "text-emerald-600" : "text-destructive"}`}
    >
      {positive ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
      {positive ? "+" : ""}
      {formatCurrency(pnl)}
    </span>
  );
}

export default async function AssetDetailPage({ params }: PageProps): Promise<React.ReactElement> {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const asset = getAssetService().getById(id);
  if (!asset) notFound();

  const lots = getAssetLotService().listLots(id);
  const priceHistory = getAssetPriceService().getHistory(id);
  const latestPrice = priceHistory.at(-1);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/assets" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            {asset.icon && <span className="text-2xl">{asset.icon}</span>}
            <h1 className="text-2xl font-bold tracking-tight">{asset.name}</h1>
          </div>
          <Badge variant="secondary" className="mt-1">
            {asset.type}
          </Badge>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-muted-foreground text-xs font-medium uppercase">
              Holdings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-xl font-bold">
              {asset.currentHoldings}{" "}
              <span className="text-muted-foreground text-sm font-normal">{asset.currency}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-muted-foreground text-xs font-medium uppercase">
              Cost Basis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{formatCurrency(asset.costBasis)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-muted-foreground text-xs font-medium uppercase">
              Current Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">
              {asset.currentValue !== null ? formatCurrency(asset.currentValue) : "—"}
            </p>
            {latestPrice && (
              <p className="text-muted-foreground mt-0.5 text-xs">
                @ {(latestPrice.pricePerUnit / 100).toFixed(2)} {asset.currency}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-muted-foreground text-xs font-medium uppercase">
              P&amp;L
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">
              <PnlDisplay pnl={asset.pnl} />
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lot history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <LotHistoryTable lots={lots} currency={asset.currency} assetType={asset.type} />
        </CardContent>
      </Card>

      {/* Price history */}
      {priceHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Price History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {[...priceHistory]
                .reverse()
                .slice(0, 10)
                .map((p) => (
                  <div key={p.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{p.recordedAt.slice(0, 10)}</span>
                    <span className="font-mono">
                      {(p.pricePerUnit / 100).toFixed(2)} {asset.currency}
                    </span>
                  </div>
                ))}
              {priceHistory.length > 10 && (
                <p className="text-muted-foreground pt-1 text-xs">
                  Showing last 10 of {priceHistory.length} price snapshots.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
