import { describe, it, expect } from "vitest";

describe("example", () => {
  it("adds numbers correctly", () => {
    expect(1 + 1).toBe(2);
  });

  it("string concatenation works", () => {
    expect("pinch" + " finance").toBe("pinch finance");
  });
});
