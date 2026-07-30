import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildListNavFilterKey,
  clearListNavContext,
  readListNavContext,
  resolveListNavNeighbors,
  writeListNavContext,
} from "./list-nav-context";

describe("list-nav-context", () => {
  afterEach(() => {
    clearListNavContext("campaigns");
    vi.unstubAllGlobals();
  });

  it("resolves prev/next across a large full filtered set (page-boundary stress)", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
    });

    const ids = Array.from({ length: 120 }, (_, i) => `camp-${String(i + 1).padStart(3, "0")}`);
    const filterKey = buildListNavFilterKey({ status: "active", q: "" });
    writeListNavContext("campaigns", { ids, filterKey });

    // Simulate page 1 item vs page-boundary (index 24→25) vs last page.
    const first = resolveListNavNeighbors("campaigns", "camp-001", filterKey);
    expect(first).toMatchObject({
      prevId: null,
      nextId: "camp-002",
      index: 0,
      total: 120,
    });

    const pageBoundary = resolveListNavNeighbors("campaigns", "camp-025", filterKey);
    expect(pageBoundary).toMatchObject({
      prevId: "camp-024",
      nextId: "camp-026",
      index: 24,
      total: 120,
    });

    const last = resolveListNavNeighbors("campaigns", "camp-120", filterKey);
    expect(last).toMatchObject({
      prevId: "camp-119",
      nextId: null,
      index: 119,
      total: 120,
    });

    expect(readListNavContext("campaigns")?.ids).toHaveLength(120);
  });

  it("invalidates neighbors when filterKey changes", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
    });

    writeListNavContext("campaigns", {
      ids: ["a", "b", "c"],
      filterKey: "status=draft",
    });

    const stale = resolveListNavNeighbors("campaigns", "b", "status=active");
    expect(stale.index).toBe(-1);
    expect(stale.prevId).toBeNull();
    expect(stale.nextId).toBeNull();
  });
});
