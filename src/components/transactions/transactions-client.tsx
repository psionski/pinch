"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Trash2, FolderInput, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  TransactionFilterBar,
  EMPTY_FILTERS,
  type TransactionFilters,
} from "./transaction-filters";
import { TransactionTable } from "./transaction-table";
import { TransactionFormDialog, type TransactionFormData } from "./transaction-form";
import { RecategorizeDialog } from "./recategorize-dialog";
import { PaginationControls } from "./pagination-controls";
import { ReceiptDialog } from "@/components/receipts/receipt-dialog";
import { ReceiptUploadDialog } from "@/components/receipts/receipt-upload-dialog";
import type {
  TransactionResponse,
  PaginatedTransactionsResponse,
} from "@/lib/validators/transactions";
import type { CategoryWithCountResponse } from "@/lib/validators/categories";

interface TransactionsClientProps {
  initialData: PaginatedTransactionsResponse;
  categories: CategoryWithCountResponse[];
}

type SortField = "date" | "amount" | "merchant" | "createdAt";
type SortOrder = "asc" | "desc";

function buildQueryString(
  filters: TransactionFilters,
  sortBy: SortField,
  sortOrder: SortOrder,
  limit: number,
  offset: number
): string {
  const params = new URLSearchParams();
  params.set("sortBy", sortBy);
  params.set("sortOrder", sortOrder);
  params.set("limit", String(limit));
  params.set("offset", String(offset));

  if (filters.search) params.set("search", filters.search);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.type) params.set("type", filters.type);

  if (filters.categoryId === "uncategorized") {
    params.set("categoryId", "null");
  } else if (filters.categoryId) {
    params.set("categoryId", filters.categoryId);
  }

  if (filters.amountMin) {
    params.set("amountMin", String(Math.round(parseFloat(filters.amountMin) * 100)));
  }
  if (filters.amountMax) {
    params.set("amountMax", String(Math.round(parseFloat(filters.amountMax) * 100)));
  }

  if (filters.recurringId) params.set("recurringId", filters.recurringId);

  return params.toString();
}

export function TransactionsClient({
  initialData,
  categories,
}: TransactionsClientProps): React.ReactElement {
  const searchParams = useSearchParams();
  const initialFilters = useMemo((): TransactionFilters => {
    const categoryId = searchParams.get("categoryId");
    const recurringId = searchParams.get("recurringId");
    const overrides: Partial<TransactionFilters> = {};
    if (categoryId) overrides.categoryId = categoryId;
    if (recurringId) overrides.recurringId = recurringId;
    return { ...EMPTY_FILTERS, ...overrides };
  }, [searchParams]);

  const [data, setData] = useState<PaginatedTransactionsResponse>(initialData);
  const [filters, setFilters] = useState<TransactionFilters>(initialFilters);
  const [recurringName, setRecurringName] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  // Dialogs
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTx, setEditingTx] = useState<TransactionResponse | null>(null);
  const [showRecategorize, setShowRecategorize] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [viewingReceiptId, setViewingReceiptId] = useState<number | null>(null);
  const [showUploadReceipt, setShowUploadReceipt] = useState(false);

  const categoryMap = new Map<number, CategoryWithCountResponse>(categories.map((c) => [c.id, c]));

  const fetchTransactions = useCallback(
    async (
      f: TransactionFilters,
      sb: SortField,
      so: SortOrder,
      lim: number,
      off: number
    ): Promise<void> => {
      setLoading(true);
      try {
        const qs = buildQueryString(f, sb, so, lim, off);
        const res = await fetch(`/api/transactions?${qs}`);
        if (res.ok) {
          const json = (await res.json()) as PaginatedTransactionsResponse;
          setData(json);
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Re-fetch when filters/sort/pagination change
  useEffect(() => {
    void fetchTransactions(filters, sortBy, sortOrder, limit, offset);
  }, [filters, sortBy, sortOrder, limit, offset, fetchTransactions]);

  // Fetch recurring template name when recurringId filter is active
  useEffect(() => {
    if (!filters.recurringId) {
      setRecurringName("");
      return;
    }
    fetch(`/api/recurring/${filters.recurringId}`)
      .then(async (res) => {
        if (res.ok) {
          const json = (await res.json()) as { description: string };
          setRecurringName(json.description);
        }
      })
      .catch(() => setRecurringName(""));
  }, [filters.recurringId]);

  function handleSortChange(field: SortField): void {
    if (field === sortBy) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setOffset(0);
  }

  function handleFiltersChange(newFilters: TransactionFilters): void {
    setFilters(newFilters);
    setOffset(0);
    setSelectedIds(new Set());
  }

  function handleLimitChange(newLimit: number): void {
    setLimit(newLimit);
    setOffset(0);
  }

  async function handleAddTransaction(formData: TransactionFormData): Promise<void> {
    setFormLoading(true);
    try {
      const body: Record<string, unknown> = {
        amount: formData.amount,
        type: formData.type,
        description: formData.description,
        date: formData.date,
      };
      if (formData.merchant) body.merchant = formData.merchant;
      if (formData.categoryId) body.categoryId = formData.categoryId;
      if (formData.notes) body.notes = formData.notes;
      if (formData.tags.length > 0) body.tags = formData.tags;

      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowAddForm(false);
        void fetchTransactions(filters, sortBy, sortOrder, limit, offset);
      }
    } finally {
      setFormLoading(false);
    }
  }

  async function handleEditTransaction(formData: TransactionFormData): Promise<void> {
    if (!editingTx) return;
    setFormLoading(true);
    try {
      const body: Record<string, unknown> = {
        amount: formData.amount,
        type: formData.type,
        description: formData.description,
        date: formData.date,
        merchant: formData.merchant || null,
        categoryId: formData.categoryId,
        notes: formData.notes || null,
        tags: formData.tags.length > 0 ? formData.tags : null,
      };

      const res = await fetch(`/api/transactions/${editingTx.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setEditingTx(null);
        void fetchTransactions(filters, sortBy, sortOrder, limit, offset);
      }
    } finally {
      setFormLoading(false);
    }
  }

  async function handleInlineUpdate(id: number, updates: Record<string, unknown>): Promise<void> {
    const res = await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      void fetchTransactions(filters, sortBy, sortOrder, limit, offset);
    }
  }

  async function handleBulkDelete(): Promise<void> {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setLoading(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        void fetchTransactions(filters, sortBy, sortOrder, limit, offset);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRecategorize(categoryId: number): Promise<void> {
    if (selectedIds.size === 0) return;
    setFormLoading(true);
    try {
      const updates = Array.from(selectedIds).map((id) => ({
        id,
        categoryId,
      }));

      const res = await fetch("/api/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      if (res.ok) {
        setShowRecategorize(false);
        setSelectedIds(new Set());
        void fetchTransactions(filters, sortBy, sortOrder, limit, offset);
      }
    } finally {
      setFormLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowUploadReceipt(true)}>
            <ScanLine className="size-4" />
            Add Receipt
          </Button>
          <Button onClick={() => setShowAddForm(true)} size="sm">
            <Plus className="size-4" />
            Add Transaction
          </Button>
        </div>
      </div>

      {/* Filters */}
      <TransactionFilterBar
        filters={filters}
        categories={categories}
        onFiltersChange={handleFiltersChange}
        recurringName={recurringName}
      />

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="bg-muted/50 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          <span className="font-medium">{selectedIds.size} selected</span>
          <Button variant="outline" size="sm" onClick={() => setShowRecategorize(true)}>
            <FolderInput className="size-3.5" />
            Recategorize
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => void handleBulkDelete()}
            disabled={loading}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
            Clear selection
          </Button>
        </div>
      )}

      {/* Table */}
      <div className={loading ? "pointer-events-none opacity-60" : ""}>
        <TransactionTable
          transactions={data.data}
          categories={categoryMap}
          categoryList={categories}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
          onEdit={setEditingTx}
          onInlineUpdate={handleInlineUpdate}
          onReceiptClick={setViewingReceiptId}
        />
      </div>

      {/* Pagination */}
      <PaginationControls
        total={data.total}
        limit={limit}
        offset={offset}
        onPageChange={setOffset}
        onLimitChange={handleLimitChange}
      />

      {/* Add form dialog */}
      <TransactionFormDialog
        open={showAddForm}
        onOpenChange={setShowAddForm}
        categories={categories}
        onSubmit={(d) => void handleAddTransaction(d)}
        loading={formLoading}
      />

      {/* Edit form dialog */}
      <TransactionFormDialog
        key={editingTx?.id ?? "new"}
        open={!!editingTx}
        onOpenChange={(open) => {
          if (!open) setEditingTx(null);
        }}
        categories={categories}
        onSubmit={(d) => void handleEditTransaction(d)}
        initialData={editingTx}
        loading={formLoading}
      />

      {/* Recategorize dialog */}
      <RecategorizeDialog
        open={showRecategorize}
        onOpenChange={setShowRecategorize}
        selectedCount={selectedIds.size}
        categories={categories}
        onConfirm={(catId) => void handleRecategorize(catId)}
        loading={formLoading}
      />

      {/* Receipt detail dialog */}
      <ReceiptDialog
        receiptId={viewingReceiptId}
        onOpenChange={(open) => {
          if (!open) setViewingReceiptId(null);
        }}
        onDeleted={() => void fetchTransactions(filters, sortBy, sortOrder, limit, offset)}
      />

      {/* Receipt upload dialog */}
      <ReceiptUploadDialog
        open={showUploadReceipt}
        onOpenChange={setShowUploadReceipt}
        onUploaded={(receiptId) => setViewingReceiptId(receiptId)}
      />
    </div>
  );
}
