"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import type { RecurringResponse } from "@/lib/validators/recurring";
import type { TransactionResponse } from "@/lib/validators/transactions";

interface GeneratedTransactionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: RecurringResponse | null;
}

export function GeneratedTransactionsDialog({
  open,
  onOpenChange,
  item,
}: GeneratedTransactionsDialogProps): React.ReactElement {
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const lastFetchedId = useRef<number | null>(null);

  const fetchTransactions = useCallback(async (recurringId: number): Promise<void> => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        recurringId: String(recurringId),
        limit: "50",
        sortBy: "date",
        sortOrder: "desc",
      });
      const res = await fetch(`/api/transactions?${params}`);
      if (res.ok) {
        const json = (await res.json()) as { data: TransactionResponse[]; total: number };
        setTransactions(json.data);
        setTotal(json.total);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch when dialog opens with a new item
  if (open && item && lastFetchedId.current !== item.id) {
    lastFetchedId.current = item.id;
    void fetchTransactions(item.id);
  }

  // Reset tracked id when dialog closes
  if (!open && lastFetchedId.current !== null) {
    lastFetchedId.current = null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generated Transactions</DialogTitle>
          <DialogDescription>
            {item?.description}
            {!loading && ` — ${total} transaction${total !== 1 ? "s" : ""}`}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              No transactions generated yet.
            </p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-md px-2 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-sm">{tx.description}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {formatDate(tx.date)}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 text-sm tabular-nums ${
                      tx.type === "income" ? "text-emerald-600" : "text-foreground"
                    }`}
                  >
                    {tx.type === "income" ? "+" : "-"}
                    {formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
