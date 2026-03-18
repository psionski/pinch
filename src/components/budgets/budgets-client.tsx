"use client";

import { useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plus, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BudgetTable } from "./budget-table";
import { BudgetFormDialog } from "./budget-form-dialog";
import { DeleteBudgetDialog } from "./delete-budget-dialog";
import { formatMonth } from "@/lib/format";
import type { BudgetStatusItem } from "@/lib/validators/reports";
import type { CategoryWithCountResponse } from "@/lib/validators/categories";

interface BudgetsClientProps {
  initialBudgetStatus: BudgetStatusItem[];
  initialCategories: CategoryWithCountResponse[];
  currentMonth: string;
}

function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const d = new Date(year, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function BudgetsClient({
  initialBudgetStatus,
  initialCategories,
  currentMonth,
}: BudgetsClientProps): React.ReactElement {
  const [month, setMonth] = useState(currentMonth);
  const [budgetStatus, setBudgetStatus] = useState(initialBudgetStatus);
  const [categories] = useState(initialCategories);
  const [loading, setLoading] = useState(false);

  // Dialog states
  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetStatusItem | null>(null);
  const [deletingBudget, setDeletingBudget] = useState<BudgetStatusItem | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const refresh = useCallback(async (m: string): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch(`/api/budgets?month=${m}`);
      if (res.ok) setBudgetStatus((await res.json()) as BudgetStatusItem[]);
    } finally {
      setLoading(false);
    }
  }, []);

  function navigateMonth(delta: number): void {
    const newMonth = shiftMonth(month, delta);
    setMonth(newMonth);
    void refresh(newMonth);
  }

  async function handleSetBudget(data: {
    categoryId: number;
    month: string;
    amount: number;
    applyToFutureMonths: boolean;
  }): Promise<void> {
    setFormLoading(true);
    try {
      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setShowForm(false);
        setEditingBudget(null);
        void refresh(month);
      }
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!deletingBudget) return;
    setFormLoading(true);
    try {
      const params = new URLSearchParams({
        categoryId: String(deletingBudget.categoryId),
        month,
      });
      const res = await fetch(`/api/budgets?${params}`, { method: "DELETE" });
      if (res.ok) {
        setDeletingBudget(null);
        void refresh(month);
      }
    } finally {
      setFormLoading(false);
    }
  }

  async function handleCopyFromPrevious(): Promise<void> {
    setLoading(true);
    try {
      const prevMonth = shiftMonth(month, -1);
      const res = await fetch("/api/budgets/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromMonth: prevMonth, toMonth: month }),
      });
      if (res.ok) {
        void refresh(month);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleCopyFromPrevious()}>
            <Copy className="size-4" />
            Copy from {formatMonth(shiftMonth(month, -1))}
          </Button>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="size-4" />
            Add Budget
          </Button>
        </div>
      </div>

      {/* Month navigator */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon-sm" onClick={() => navigateMonth(-1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-lg font-semibold">{formatMonth(month)}</span>
        <Button variant="outline" size="icon-sm" onClick={() => navigateMonth(1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Budget table */}
      <div className={loading ? "pointer-events-none opacity-60" : ""}>
        <BudgetTable
          budgets={budgetStatus}
          onEdit={setEditingBudget}
          onDelete={setDeletingBudget}
        />
      </div>

      {/* Create dialog */}
      <BudgetFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        categories={categories}
        currentMonth={month}
        onSubmit={(d) => void handleSetBudget(d)}
        loading={formLoading}
      />

      {/* Edit dialog */}
      <BudgetFormDialog
        key={editingBudget?.categoryId ?? "new"}
        open={!!editingBudget}
        onOpenChange={(open) => {
          if (!open) setEditingBudget(null);
        }}
        categories={categories}
        currentMonth={month}
        onSubmit={(d) => void handleSetBudget(d)}
        initialData={editingBudget}
        loading={formLoading}
      />

      {/* Delete dialog */}
      <DeleteBudgetDialog
        open={!!deletingBudget}
        onOpenChange={(open) => {
          if (!open) setDeletingBudget(null);
        }}
        budget={deletingBudget}
        onConfirm={() => void handleDelete()}
        loading={formLoading}
      />
    </div>
  );
}
