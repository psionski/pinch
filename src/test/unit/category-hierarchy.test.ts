// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildChildrenMap, getDescendantIds } from "@/lib/services/category-hierarchy";

describe("buildChildrenMap", () => {
  it("builds a parent → children map", () => {
    const cats = [
      { id: 1, parentId: null },
      { id: 2, parentId: 1 },
      { id: 3, parentId: 1 },
      { id: 4, parentId: 2 },
    ];
    const map = buildChildrenMap(cats);
    expect(map.get(1)).toEqual([2, 3]);
    expect(map.get(2)).toEqual([4]);
    expect(map.has(3)).toBe(false);
    expect(map.has(4)).toBe(false);
  });

  it("returns empty map for flat categories", () => {
    const cats = [
      { id: 1, parentId: null },
      { id: 2, parentId: null },
    ];
    const map = buildChildrenMap(cats);
    expect(map.size).toBe(0);
  });

  it("returns empty map for empty input", () => {
    const map = buildChildrenMap([]);
    expect(map.size).toBe(0);
  });
});

describe("getDescendantIds", () => {
  const cats = [
    { id: 1, parentId: null },
    { id: 2, parentId: 1 },
    { id: 3, parentId: 1 },
    { id: 4, parentId: 2 },
    { id: 5, parentId: 4 },
  ];
  const childrenMap = buildChildrenMap(cats);

  it("returns all descendants of a root category", () => {
    const ids = getDescendantIds(1, childrenMap);
    expect(ids.sort()).toEqual([2, 3, 4, 5]);
  });

  it("returns nested descendants", () => {
    const ids = getDescendantIds(2, childrenMap);
    expect(ids.sort()).toEqual([4, 5]);
  });

  it("returns empty array for leaf category", () => {
    expect(getDescendantIds(5, childrenMap)).toEqual([]);
  });

  it("returns empty array for unknown category ID", () => {
    expect(getDescendantIds(999, childrenMap)).toEqual([]);
  });
});
