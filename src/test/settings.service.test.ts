// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "./helpers";
import { SettingsService } from "@/lib/services/settings";

let service: SettingsService;

beforeEach(() => {
  service = new SettingsService(makeTestDb());
});

describe("get", () => {
  it("returns null for a missing key", () => {
    expect(service.get("nonexistent")).toBeNull();
  });

  it("returns the value for an existing key", () => {
    service.set("theme", "dark");
    expect(service.get("theme")).toBe("dark");
  });
});

describe("set", () => {
  it("creates a new setting", () => {
    service.set("foo", "bar");
    expect(service.get("foo")).toBe("bar");
  });

  it("upserts an existing setting", () => {
    service.set("foo", "bar");
    service.set("foo", "baz");
    expect(service.get("foo")).toBe("baz");
    expect(service.list()).toHaveLength(1);
  });
});

describe("delete", () => {
  it("returns false for a missing key", () => {
    expect(service.delete("nonexistent")).toBe(false);
  });

  it("deletes an existing key and returns true", () => {
    service.set("to-delete", "value");
    expect(service.delete("to-delete")).toBe(true);
    expect(service.get("to-delete")).toBeNull();
  });
});

describe("list", () => {
  it("returns empty array when no settings", () => {
    expect(service.list()).toEqual([]);
  });

  it("returns all settings", () => {
    service.set("a", "1");
    service.set("b", "2");
    const all = service.list();
    expect(all).toHaveLength(2);
    expect(all.map((s) => s.key).sort()).toEqual(["a", "b"]);
  });
});
