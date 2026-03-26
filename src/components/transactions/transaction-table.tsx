"use client";

import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Receipt,
  Repeat,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency, formatDate } from "@/lib/format";
import type { TransactionResponse } from "@/lib/validators/transactions";
import type { CategoryWithCountResponse } from "@/lib/validators/categories";

type SortField = "date" | "amount" | "merchant" | "createdAt";
type SortOrder = "asc" | "desc";

interface TransactionTableProps {
  transactions: TransactionResponse[];
  categories: Map<number, CategoryWithCountResponse>;
  selectedIds: Set<number>;
  onSelectionChange: (ids: Set<number>) => void;
  sortBy: SortField;
  sortOrder: SortOrder;
  onSortChange: (field: SortField) => void;
  onEdit: (tx: TransactionResponse) => void;
  onDelete: (tx: TransactionResponse) => void;
  onReceiptClick?: (receiptId: number) => void;
}

function SortIcon({
  field,
  currentSort,
  currentOrder,
}: {
  field: SortField;
  currentSort: SortField;
  currentOrder: SortOrder;
}): React.ReactElement {
  if (field !== currentSort) {
    return <ArrowUpDown className="ml-1 inline size-3.5 opacity-40" />;
  }
  return currentOrder === "asc" ? (
    <ArrowUp className="ml-1 inline size-3.5" />
  ) : (
    <ArrowDown className="ml-1 inline size-3.5" />
  );
}

export function TransactionTable({
  transactions,
  categories,
  selectedIds,
  onSelectionChange,
  sortBy,
  sortOrder,
  onSortChange,
  onEdit,
  onDelete,
  onReceiptClick,
}: TransactionTableProps): React.ReactElement {
  const allSelected = transactions.length > 0 && selectedIds.size === transactions.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  function toggleAll(): void {
    if (someSelected || allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(transactions.map((t) => t.id)));
    }
  }

  function toggleOne(id: number): void {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  }

  function renderSortableHeader(label: string, field: SortField): React.ReactElement {
    return (
      <button
        type="button"
        className="hover:text-foreground inline-flex items-center"
        onClick={() => onSortChange(field)}
      >
        {label}
        <SortIcon field={field} currentSort={sortBy} currentOrder={sortOrder} />
      </button>
    );
  }

  if (transactions.length === 0) {
    return (
      <EmptyState message="No transactions found." description="Try adjusting your filters." />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40px]">
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={toggleAll}
              aria-label="Select all"
            />
          </TableHead>
          <TableHead>{renderSortableHeader("Date", "date")}</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>{renderSortableHeader("Merchant", "merchant")}</TableHead>
          <TableHead>Category</TableHead>
          <TableHead className="text-right">{renderSortableHeader("Amount", "amount")}</TableHead>
          <TableHead className="w-[50px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((tx) => {
          const category = tx.categoryId ? categories.get(tx.categoryId) : null;

          return (
            <TableRow
              key={tx.id}
              data-testid={`transaction-row-${tx.id}`}
              data-state={selectedIds.has(tx.id) ? "selected" : undefined}
            >
              <TableCell>
                <Checkbox
                  checked={selectedIds.has(tx.id)}
                  onCheckedChange={() => toggleOne(tx.id)}
                  aria-label={`Select transaction ${tx.id}`}
                />
              </TableCell>
              <TableCell className="text-sm tabular-nums">{formatDate(tx.date)}</TableCell>
              <TableCell className="max-w-[250px]">
                <div className="flex items-center gap-1.5">
                  <span className="truncate">{tx.description}</span>
                  {tx.receiptId && (
                    <button
                      type="button"
                      onClick={() => onReceiptClick?.(tx.receiptId!)}
                      className="text-muted-foreground hover:text-foreground shrink-0"
                      aria-label="View receipt"
                    >
                      <Receipt className="size-3.5" />
                    </button>
                  )}
                  {tx.recurringId && (
                    <Repeat
                      className="text-muted-foreground size-3.5 shrink-0"
                      aria-label="Recurring"
                    />
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm">{tx.merchant ?? "—"}</TableCell>
              <TableCell>{category ? category.name : "—"}</TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                <span className={tx.type === "income" ? "text-emerald-600" : "text-foreground"}>
                  {formatCurrency(tx.amount)}
                </span>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-xs" aria-label="Transaction actions">
                      <MoreHorizontal className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(tx)}>
                      <Pencil className="size-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => onDelete(tx)}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
