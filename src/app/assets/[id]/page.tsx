import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { getAssetService, getAssetLotService, getPortfolioReportService } from "@/lib/api/services";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LotHistoryTable } from "@/components/assets/lot-history-table";
import { AssetDetailCharts } from "@/components/assets/asset-detail-charts";
import { formatCurrency } from "@/lib/format";

interface PageProps {
  params: Promise<{ id: string }>;
}

function PnlDisplay({ pnl, label }: { pnl: number | null; label?: string }): React.ReactElement {
  if (pnl === null) return <span className="text-muted-foreground">—</span>;
  const positive = pnl >= 0;
  return (
    <span
      className={`flex items-center gap-1 font-semibold ${positive ? "text-emerald-600" : "text-destructive"}`}
    >
      {positive ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
      {label && <span className="text-muted-foreground mr-1 text-xs font-normal">{label}</span>}
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

  // Realized P&L for this specific asset
  const reportService = getPortfolioReportService();
  const realizedPnlResult = reportService.getRealizedPnL();
  const assetRealizedPnl = realizedPnlResult.items.find((item) => item.assetId === id);
  const realizedPnl = assetRealizedPnl?.realizedPnl ?? null;
  const unrealizedPnl =
    asset.pnl !== null && realizedPnl !== null ? asset.pnl - realizedPnl : asset.pnl;

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
            {asset.latestPrice !== null && (
              <p className="text-muted-foreground mt-0.5 text-xs">
                @ {(asset.latestPrice / 100).toFixed(2)} {asset.currency}
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
          <CardContent className="space-y-1">
            <p className="text-xl font-bold">
              <PnlDisplay pnl={asset.pnl} />
            </p>
            <div className="space-y-0.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground text-xs">Unrealized</span>
                <PnlDisplay pnl={unrealizedPnl} />
              </div>
              {realizedPnl !== null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs">Realized</span>
                  <PnlDisplay pnl={realizedPnl} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <AssetDetailCharts assetId={id} currency={asset.currency} />

      {/* Lot history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <LotHistoryTable lots={lots} currency={asset.currency} assetType={asset.type} />
        </CardContent>
      </Card>
    </div>
  );
}
