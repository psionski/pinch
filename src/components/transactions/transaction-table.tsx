"use client";

import { useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Receipt, Repeat, Pencil, Check, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/format";
import type { TransactionResponse } from "@/lib/validators/transactions";
import type { CategoryWithCountResponse } from "@/lib/validators/categories";

type SortField = "date" | "amount" | "merchant" | "createdAt";
type SortOrder = "asc" | "desc";

interface TransactionTableProps {
  transactions: TransactionResponse[];
  categories: Map<number, CategoryWithCountResponse>;
  categoryList: CategoryWithCountResponse[];
  selectedIds: Set<number>;
  onSelectionChange: (ids: Set<number>) => void;
  sortBy: SortField;
  sortOrder: SortOrder;
  onSortChange: (field: SortField) => void;
  onEdit: (tx: TransactionResponse) => void;
  onInlineUpdate: (id: number, updates: Record<string, unknown>) => Promise<void>;
}

interface InlineEditState {
  id: number;
  field: string;
  value: string;
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
  categoryList,
  selectedIds,
  onSelectionChange,
  sortBy,
  sortOrder,
  onSortChange,
  onEdit,
  onInlineUpdate,
}: TransactionTableProps): React.ReactElement {
  const [inlineEdit, setInlineEdit] = useState<InlineEditState | null>(null);
  const [saving, setSaving] = useState(false);

  const allSelected = transactions.length > 0 && selectedIds.size === transactions.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  function toggleAll(): void {
    if (allSelected) {
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

  function startInlineEdit(id: number, field: string, value: string): void {
    setInlineEdit({ id, field, value });
  }

  async function commitInlineEdit(): Promise<void> {
    if (!inlineEdit) return;
    setSaving(true);
    try {
      const { id, field, value } = inlineEdit;
      let updates: Record<string, unknown>;

      if (field === "amount") {
        const cents = Math.round(parseFloat(value) * 100);
        if (Number.isNaN(cents) || cents <= 0) return;
        updates = { amount: cents };
      } else if (field === "categoryId") {
        updates = {
          categoryId: value === "none" ? null : Number(value),
        };
      } else {
        updates = { [field]: value };
      }

      await onInlineUpdate(id, updates);
    } finally {
      setSaving(false);
      setInlineEdit(null);
    }
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

  function renderCell(
    tx: TransactionResponse,
    field: string,
    displayValue: string
  ): React.ReactElement {
    const isEditing = inlineEdit?.id === tx.id && inlineEdit?.field === field;

    if (isEditing) {
      if (field === "categoryId") {
        return (
          <div className="flex items-center gap-1">
            <Select
              value={inlineEdit.value}
              onValueChange={(v) => setInlineEdit({ ...inlineEdit, value: v })}
            >
              <SelectTrigger className="h-7 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {categoryList.map((cat) => (
                  <SelectItem key={cat.id} value={String(cat.id)}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => void commitInlineEdit()}
              disabled={saving}
            >
              <Check className="size-3" />
            </Button>
            <Button size="icon-xs" variant="ghost" onClick={() => setInlineEdit(null)}>
              <X className="size-3" />
            </Button>
          </div>
        );
      }

      return (
        <div className="flex items-center gap-1">
          <Input
            className="h-7 w-[120px] text-xs"
            type={field === "amount" ? "number" : "text"}
            step={field === "amount" ? "0.01" : undefined}
            value={inlineEdit.value}
            onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") void commitInlineEdit();
              if (e.key === "Escape") setInlineEdit(null);
            }}
            autoFocus
          />
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => void commitInlineEdit()}
            disabled={saving}
          >
            <Check className="size-3" />
          </Button>
          <Button size="icon-xs" variant="ghost" onClick={() => setInlineEdit(null)}>
            <X className="size-3" />
          </Button>
        </div>
      );
    }

    return (
      <span
        className="hover:bg-muted -mx-1 cursor-pointer rounded px-1"
        onClick={() =>
          startInlineEdit(
            tx.id,
            field,
            field === "amount"
              ? (tx.amount / 100).toFixed(2)
              : field === "categoryId"
                ? tx.categoryId
                  ? String(tx.categoryId)
                  : "none"
                : String(displayValue)
          )
        }
      >
        {displayValue}
      </span>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-muted-foreground py-16 text-center text-sm">No transactions found.</div>
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
          <TableHead className="w-[80px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((tx) => {
          const category = tx.categoryId ? categories.get(tx.categoryId) : null;

          return (
            <TableRow key={tx.id} data-state={selectedIds.has(tx.id) ? "selected" : undefined}>
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
                  {renderCell(tx, "description", tx.description)}
                  {tx.receiptId && (
                    <Receipt
                      className="text-muted-foreground size-3.5 shrink-0"
                      aria-label="Has receipt"
                    />
                  )}
                  {tx.recurringId && (
                    <Repeat
                      className="text-muted-foreground size-3.5 shrink-0"
                      aria-label="Recurring"
                    />
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm">
                {renderCell(tx, "merchant", tx.merchant ?? "—")}
              </TableCell>
              <TableCell>{renderCell(tx, "categoryId", category ? category.name : "—")}</TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                <span className={tx.type === "income" ? "text-emerald-600" : "text-foreground"}>
                  {tx.type === "income" ? "+" : "-"}
                  {renderCell(tx, "amount", formatCurrency(tx.amount))}
                </span>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onEdit(tx)}
                  aria-label="Edit transaction"
                >
                  <Pencil className="size-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
