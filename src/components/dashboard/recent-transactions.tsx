import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency, formatDate, getBaseCurrency } from "@/lib/format";
import type { TransactionResponse } from "@/lib/validators/transactions";
import type { CategoryWithCountResponse } from "@/lib/validators/categories";

interface RecentTransactionsProps {
  transactions: TransactionResponse[];
  categories: Map<number, CategoryWithCountResponse>;
}

export function RecentTransactions({
  transactions,
  categories,
}: RecentTransactionsProps): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        {transactions.length > 0 ? (
          <div className="space-y-3">
            {transactions.map((tx) => {
              const category = tx.categoryId ? categories.get(tx.categoryId) : null;

              return (
                <div key={tx.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{tx.description}</span>
                      {category && (
                        <Badge variant="secondary" className="shrink-0">
                          {category.name}
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground flex items-center gap-2 text-xs">
                      <span>{formatDate(tx.date)}</span>
                      {tx.merchant && (
                        <>
                          <span>&middot;</span>
                          <span className="truncate">{tx.merchant}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {tx.currency !== getBaseCurrency() ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className={`shrink-0 text-sm font-medium tabular-nums ${
                            tx.type === "income" ? "text-emerald-600" : "text-foreground"
                          }`}
                        >
                          {formatCurrency(tx.amount, tx.currency)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>≈ {formatCurrency(tx.amountBase)} (base)</TooltipContent>
                    </Tooltip>
                  ) : (
                    <span
                      className={`shrink-0 text-sm font-medium tabular-nums ${
                        tx.type === "income" ? "text-emerald-600" : "text-foreground"
                      }`}
                    >
                      {formatCurrency(tx.amount, tx.currency)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground py-10 text-center text-sm">No transactions yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
