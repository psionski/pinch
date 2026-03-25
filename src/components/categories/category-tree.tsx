"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronDown, MoreHorizontal, Pencil, Merge, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CategoryWithCountResponse } from "@/lib/validators/categories";
import type { BudgetStatsItem } from "@/lib/validators/reports";

interface CategoryTreeProps {
  categories: CategoryWithCountResponse[];
  stats: BudgetStatsItem[];
  onEdit: (category: CategoryWithCountResponse) => void;
  onMerge: (category: CategoryWithCountResponse) => void;
  onDelete: (category: CategoryWithCountResponse) => void;
}

interface TreeNode {
  category: CategoryWithCountResponse;
  children: TreeNode[];
}

function buildTree(categories: CategoryWithCountResponse[]): TreeNode[] {
  const map = new Map<number, TreeNode>();
  const roots: TreeNode[] = [];

  for (const cat of categories) {
    map.set(cat.id, { category: cat, children: [] });
  }

  for (const cat of categories) {
    const node = map.get(cat.id)!;
    if (cat.parentId !== null && map.has(cat.parentId)) {
      map.get(cat.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort alphabetically at each level
  const sortNodes = (nodes: TreeNode[]): void => {
    nodes.sort((a, b) => a.category.name.localeCompare(b.category.name));
    for (const node of nodes) sortNodes(node.children);
  };
  sortNodes(roots);

  return roots;
}

function formatAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

function BudgetBar({ spent, budget }: { spent: number; budget: number }): React.ReactElement {
  const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const color = pct < 60 ? "bg-green-500" : pct < 90 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className="bg-muted h-2 w-20 overflow-hidden rounded-full">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-muted-foreground text-xs">
        {formatAmount(spent)} / {formatAmount(budget)}
      </span>
    </div>
  );
}

function CategoryRow({
  node,
  depth,
  stats,
  expanded,
  onToggle,
  onEdit,
  onMerge,
  onDelete,
  onNavigate,
}: {
  node: TreeNode;
  depth: number;
  stats: Map<number, BudgetStatsItem>;
  expanded: Set<number>;
  onToggle: (id: number) => void;
  onEdit: (category: CategoryWithCountResponse) => void;
  onMerge: (category: CategoryWithCountResponse) => void;
  onDelete: (category: CategoryWithCountResponse) => void;
  onNavigate: (categoryId: number) => void;
}): React.ReactElement {
  const cat = node.category;
  const catStats = stats.get(cat.id);
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(cat.id);

  return (
    <>
      <tr className="hover:bg-muted/50 border-b" data-testid={`category-row-${cat.id}`}>
        {/* Name with indent + expand/collapse */}
        <td className="py-2 pr-2" style={{ paddingLeft: `${depth * 24 + 8}px` }}>
          <div className="flex items-center gap-1.5">
            {hasChildren ? (
              <button
                onClick={() => onToggle(cat.id)}
                className="text-muted-foreground hover:text-foreground shrink-0 p-0.5"
              >
                {isExpanded ? (
                  <ChevronDown className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                )}
              </button>
            ) : (
              <span className="w-5 shrink-0" />
            )}
            {cat.color && (
              <span
                className="inline-block size-3 shrink-0 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
            )}
            {cat.icon && <span className="shrink-0 text-sm">{cat.icon}</span>}
            <button
              onClick={() => onNavigate(cat.id)}
              className="hover:text-primary truncate text-left font-medium hover:underline"
            >
              {cat.name}
            </button>
          </div>
        </td>

        {/* Transaction count — all-time rollup for parents, own count for leaves */}
        <td className="text-muted-foreground px-2 py-2 text-right text-sm tabular-nums">
          {catStats?.rollupCount ?? cat.transactionCount}
        </td>

        {/* Current month spend — show rollup for parents */}
        <td className="text-muted-foreground px-2 py-2 text-right text-sm tabular-nums">
          {catStats && (hasChildren ? catStats.rollupTotal : catStats.total) > 0
            ? `€${formatAmount(hasChildren ? catStats.rollupTotal : catStats.total)}`
            : "—"}
        </td>

        {/* Budget status — use rollup spend vs budget (includes child category spend) */}
        <td className="px-2 py-2">
          {catStats?.budgetAmount ? (
            <BudgetBar spent={catStats.rollupTotal} budget={catStats.budgetAmount} />
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          )}
        </td>

        {/* Actions */}
        <td className="px-2 py-2 text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="size-8 p-0"
                data-testid={`category-actions-${cat.id}`}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(cat)}>
                <Pencil className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onMerge(cat)}>
                <Merge className="size-4" />
                Merge into...
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(cat)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      </tr>

      {/* Render children if expanded */}
      {isExpanded &&
        node.children.map((child) => (
          <CategoryRow
            key={child.category.id}
            node={child}
            depth={depth + 1}
            stats={stats}
            expanded={expanded}
            onToggle={onToggle}
            onEdit={onEdit}
            onMerge={onMerge}
            onDelete={onDelete}
            onNavigate={onNavigate}
          />
        ))}
    </>
  );
}

export function CategoryTree({
  categories,
  stats,
  onEdit,
  onMerge,
  onDelete,
}: CategoryTreeProps): React.ReactElement {
  const router = useRouter();
  const tree = buildTree(categories);
  const statsMap = new Map(
    stats.filter((s) => s.categoryId !== null).map((s) => [s.categoryId!, s])
  );

  // Start with all parent categories expanded
  const [expanded, setExpanded] = useState<Set<number>>(() => {
    const ids = new Set<number>();
    for (const cat of categories) {
      if (categories.some((c) => c.parentId === cat.id)) {
        ids.add(cat.id);
      }
    }
    return ids;
  });

  function handleToggle(id: number): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleNavigate(categoryId: number): void {
    router.push(`/transactions?categoryId=${categoryId}`);
  }

  if (categories.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center py-12 text-center">
        <p className="text-lg font-medium">No categories yet</p>
        <p className="text-sm">Create your first category to start organizing transactions.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b text-left">
            <th className="px-2 py-2.5 font-medium">Category</th>
            <th className="px-2 py-2.5 text-right font-medium">Transactions</th>
            <th className="px-2 py-2.5 text-right font-medium">This Month</th>
            <th className="px-2 py-2.5 font-medium">Budget</th>
            <th className="w-12 px-2 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {tree.map((node) => (
            <CategoryRow
              key={node.category.id}
              node={node}
              depth={0}
              stats={statsMap}
              expanded={expanded}
              onToggle={handleToggle}
              onEdit={onEdit}
              onMerge={onMerge}
              onDelete={onDelete}
              onNavigate={handleNavigate}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
