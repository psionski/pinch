"use client";

import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
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
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete Budget"
      description={
        <>
          Are you sure you want to delete the budget for <strong>{budget?.categoryName}</strong>?
        </>
      }
      onConfirm={onConfirm}
      loading={loading}
    >
      {budget && (
        <p>
          Budget of <strong>{formatCurrency(budget.budgetAmount)}</strong> will be removed.
        </p>
      )}
    </ConfirmDeleteDialog>
  );
}
