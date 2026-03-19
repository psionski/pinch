/**
 * Pure helpers for navigating the category parent→child tree.
 * Used by TransactionService (descendant filtering) and ReportService (rollup).
 */

export interface CategoryNode {
  id: number;
  parentId: number | null;
}

/** Build a map from parent ID → list of direct child IDs. */
export function buildChildrenMap(cats: CategoryNode[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const cat of cats) {
    if (cat.parentId !== null) {
      const siblings = map.get(cat.parentId) ?? [];
      siblings.push(cat.id);
      map.set(cat.parentId, siblings);
    }
  }
  return map;
}

/** BFS to collect all descendant IDs (children, grandchildren, etc.) of a category. */
export function getDescendantIds(categoryId: number, childrenMap: Map<number, number[]>): number[] {
  const result: number[] = [];
  const queue = [...(childrenMap.get(categoryId) ?? [])];
  while (queue.length > 0) {
    const id = queue.pop()!;
    result.push(id);
    const children = childrenMap.get(id);
    if (children) queue.push(...children);
  }
  return result;
}
