"use client";

import { useState } from "react";
import { Repeat, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategorySelectItems } from "@/components/categories/category-select-items";
import type { CategoryWithCountResponse } from "@/lib/validators/categories";

export interface TransactionFilters {
  search: string;
  dateFrom: string;
  dateTo: string;
  categoryId: string; // "" = all, "uncategorized" = null, number string = specific
  type: string; // "" = all, "income", "expense"
  amountMin: string;
  amountMax: string;
  recurringId: string; // "" = all, number string = specific
}

const EMPTY_FILTERS: TransactionFilters = {
  search: "",
  dateFrom: "",
  dateTo: "",
  categoryId: "",
  type: "",
  amountMin: "",
  amountMax: "",
  recurringId: "",
};

interface TransactionFilterBarProps {
  filters: TransactionFilters;
  categories: CategoryWithCountResponse[];
  onFiltersChange: (filters: TransactionFilters) => void;
  recurringName?: string;
}

export function TransactionFilterBar({
  filters,
  categories,
  onFiltersChange,
  recurringName,
}: TransactionFilterBarProps): React.ReactElement {
  const [searchInput, setSearchInput] = useState(filters.search);

  function handleSearchSubmit(): void {
    onFiltersChange({ ...filters, search: searchInput });
  }

  const hasActiveFilters = Object.entries(filters).some(
    ([key, value]) => value !== "" && key !== "search"
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Text search */}
        <div className="relative min-w-[200px] flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search transactions..."
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              onFiltersChange({ ...filters, search: e.target.value });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearchSubmit();
            }}
            className="h-8 pl-8"
          />
        </div>

        {/* Type toggle */}
        <Select
          value={filters.type || "all"}
          onValueChange={(v) => onFiltersChange({ ...filters, type: v === "all" ? "" : v })}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="expense">Expenses</SelectItem>
            <SelectItem value="income">Income</SelectItem>
          </SelectContent>
        </Select>

        {/* Category */}
        <Select
          value={filters.categoryId || "all"}
          onValueChange={(v) => onFiltersChange({ ...filters, categoryId: v === "all" ? "" : v })}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="uncategorized">Uncategorized</SelectItem>
            <CategorySelectItems categories={categories} />
          </SelectContent>
        </Select>

        {/* Clear filters */}
        {(hasActiveFilters || filters.search) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchInput("");
              onFiltersChange(EMPTY_FILTERS);
            }}
          >
            <X className="size-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Date and amount range row */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Date:</span>
        <Input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
          className="h-8 w-[150px]"
        />
        <span className="text-muted-foreground">to</span>
        <Input
          type="date"
          value={filters.dateTo}
          onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
          className="h-8 w-[150px]"
        />

        <span className="text-muted-foreground ml-2">Amount:</span>
        <Input
          type="number"
          placeholder="Min"
          value={filters.amountMin}
          onChange={(e) => onFiltersChange({ ...filters, amountMin: e.target.value })}
          className="h-8 w-[100px]"
          min="0"
          step="0.01"
        />
        <span className="text-muted-foreground">to</span>
        <Input
          type="number"
          placeholder="Max"
          value={filters.amountMax}
          onChange={(e) => onFiltersChange({ ...filters, amountMax: e.target.value })}
          className="h-8 w-[100px]"
          min="0"
          step="0.01"
        />
      </div>

      {/* Active filter badges */}
      {filters.recurringId && recurringName && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1 py-1">
            <Repeat className="size-3" />
            Recurring: {recurringName}
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground ml-1"
              onClick={() => onFiltersChange({ ...filters, recurringId: "" })}
            >
              <X className="size-3" />
            </button>
          </Badge>
        </div>
      )}
    </div>
  );
}

export { EMPTY_FILTERS };
