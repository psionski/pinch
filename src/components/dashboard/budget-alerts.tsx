"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BudgetProgressBar } from "@/components/budgets/budget-progress-bar";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { BudgetStatusItem } from "@/lib/validators/reports";

interface BudgetAlertsProps {
  budgetStatus: BudgetStatusItem[];
}

export function BudgetAlerts({ budgetStatus }: BudgetAlertsProps): React.ReactElement {
  const alerts = budgetStatus.filter((b) => b.percentUsed > 80);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Budget Alerts</CardTitle>
        <AlertTriangle className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-muted-foreground flex items-center gap-2 py-4 text-sm">
            <CheckCircle2 className="size-4 text-emerald-500" />
            All budgets on track
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((item) => (
              <div key={item.categoryId} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{item.categoryName}</span>
                  <span
                    className={item.isOver ? "text-destructive font-medium" : "text-yellow-600"}
                  >
                    {formatPercent(item.percentUsed)}
                  </span>
                </div>
                <BudgetProgressBar percentUsed={item.percentUsed} />
                <p className="text-muted-foreground text-xs">
                  {formatCurrency(item.spentAmount)} of {formatCurrency(item.budgetAmount)}
                  {item.isOver ? " — over budget" : " — approaching limit"}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
