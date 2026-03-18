"use client";

import { SelectItem } from "@/components/ui/select";
import type { CategoryWithCountResponse } from "@/lib/validators/categories";

interface CategorySelectItemsProps {
  categories: CategoryWithCountResponse[];
}

interface FlatItem {
  category: CategoryWithCountResponse;
  depth: number;
}

/** Flatten categories into a hierarchical display order with depth info. */
function flattenHierarchy(categories: CategoryWithCountResponse[]): FlatItem[] {
  const childrenMap = new Map<number | null, CategoryWithCountResponse[]>();
  for (const cat of categories) {
    const key = cat.parentId;
    const siblings = childrenMap.get(key) ?? [];
    siblings.push(cat);
    childrenMap.set(key, siblings);
  }

  // Sort siblings alphabetically at each level
  for (const siblings of childrenMap.values()) {
    siblings.sort((a, b) => a.name.localeCompare(b.name));
  }

  const result: FlatItem[] = [];
  function walk(parentId: number | null, depth: number): void {
    const children = childrenMap.get(parentId) ?? [];
    for (const cat of children) {
      result.push({ category: cat, depth });
      walk(cat.id, depth + 1);
    }
  }
  walk(null, 0);

  return result;
}

/**
 * Renders SelectItem entries for categories with hierarchical indentation.
 * Use inside a SelectContent component.
 */
export function CategorySelectItems({
  categories,
}: CategorySelectItemsProps): React.ReactElement[] {
  const items = flattenHierarchy(categories);

  return items.map(({ category: cat, depth }) => (
    <SelectItem key={cat.id} value={String(cat.id)}>
      <span style={{ paddingLeft: `${depth * 16}px` }}>
        {cat.icon ? `${cat.icon} ` : ""}
        {cat.name}
      </span>
    </SelectItem>
  ));
}
