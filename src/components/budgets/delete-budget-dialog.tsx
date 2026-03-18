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
import { formatCurrency } from "@/lib/format";
import type { BudgetStatusItem } from "@/lib/validators/reports";

interface DeleteBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: BudgetStatusItem | null;
  onConfirm: () => void;
  loading?: boolean;
}

export function DeleteBudgetDialog({
  open,
  onOpenChange,
  budget,
  onConfirm,
  loading,
}: DeleteBudgetDialogProps): React.ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Budget</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the budget for <strong>{budget?.categoryName}</strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2 text-sm">
          {budget && (
            <p>
              Budget of <strong>{formatCurrency(budget.budgetAmount)}</strong> will be removed.
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
