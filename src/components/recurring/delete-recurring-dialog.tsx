"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, formatFrequency } from "@/lib/format";
import type { RecurringResponse } from "@/lib/validators/recurring";

interface DeleteRecurringDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: RecurringResponse | null;
  onConfirm: () => void;
  loading?: boolean;
}

export function DeleteRecurringDialog({
  open,
  onOpenChange,
  item,
  onConfirm,
  loading,
}: DeleteRecurringDialogProps): React.ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Recurring Transaction</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{item?.description}</strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2 text-sm">
          {item && (
            <p>
              This will remove the recurring template for{" "}
              <strong>{formatCurrency(item.amount)}</strong> ({formatFrequency(item)}).
              Already-generated transactions will be kept.
            </p>
          )}
          <p className="text-muted-foreground">This action cannot be undone.</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
