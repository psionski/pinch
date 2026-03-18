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
import type { CategoryWithCountResponse } from "@/lib/validators/categories";

interface DeleteCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: CategoryWithCountResponse | null;
  categories: CategoryWithCountResponse[];
  onConfirm: () => void;
  loading?: boolean;
}

export function DeleteCategoryDialog({
  open,
  onOpenChange,
  category,
  categories,
  onConfirm,
  loading,
}: DeleteCategoryDialogProps): React.ReactElement {
  const childCount = category ? categories.filter((c) => c.parentId === category.id).length : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Category</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{category?.name}</strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2 text-sm">
          {category && category.transactionCount > 0 && (
            <p>
              <strong>{category.transactionCount}</strong> transaction(s) will become uncategorized.
            </p>
          )}
          {childCount > 0 && (
            <p>
              <strong>{childCount}</strong> child categor{childCount === 1 ? "y" : "ies"} will
              become top-level.
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
