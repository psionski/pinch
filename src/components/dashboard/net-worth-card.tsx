import { TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { PortfolioResponse } from "@/lib/validators/assets";

interface NetWorthCardProps {
  portfolio: PortfolioResponse;
}

export function NetWorthCard({ portfolio }: NetWorthCardProps): React.ReactElement {
  const { netWorth, cashBalance, totalAssetValue, pnl } = portfolio;
  const pnlPositive = pnl !== null && pnl >= 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">Cash</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-2xl font-bold">{formatCurrency(cashBalance)}</p>
        <div className="space-y-1 text-sm">
          <div className="text-muted-foreground flex justify-between">
            <span>
              <Link href="/assets" className="hover:underline">
                Assets
              </Link>
            </span>
            <span className="font-mono">{formatCurrency(totalAssetValue)}</span>
          </div>
          <div className="flex justify-between border-t pt-1">
            <span className="text-muted-foreground">Net Worth</span>
            <span className="font-mono font-medium">{formatCurrency(netWorth)}</span>
          </div>
          {pnl !== null && (
            <div className="text-muted-foreground flex justify-between">
              <span>P&amp;L</span>
              <span
                className={`flex items-center gap-1 font-medium ${pnlPositive ? "text-emerald-600" : "text-destructive"}`}
              >
                {pnlPositive ? (
                  <TrendingUp className="size-3.5" />
                ) : (
                  <TrendingDown className="size-3.5" />
                )}
                {pnlPositive ? "+" : ""}
                {formatCurrency(pnl)}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
