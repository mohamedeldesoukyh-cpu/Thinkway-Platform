import assert from "node:assert/strict";
import test from "node:test";

import { classifyCacheFreshness, resolveTtlBounds, toCacheGetResult } from "./ttl";
import type { ClientCacheEntry } from "./types";

function sampleEntry(overrides: Partial<ClientCacheEntry> = {}): ClientCacheEntry {
  return {
    key: "k",
    v: 1,
    namespace: "discovery",
    kind: "browse",
    fetchedAt: 1_000,
    softExpiresAt: 2_000,
    hardExpiresAt: 5_000,
    softTtlMs: 1_000,
    hardTtlMs: 4_000,
    tags: [],
    entityIds: [],
    payload: { ok: true },
    ...overrides,
  };
}

test("resolveTtlBounds enforces hard >= soft", () => {
  const bounds = resolveTtlBounds({ softTtlMs: 5_000, hardTtlMs: 1_000 }, 0);
  assert.equal(bounds.softExpiresAt, 5_000);
  assert.equal(bounds.hardExpiresAt, 5_000);
});

test("classifyCacheFreshness soft vs hard", () => {
  const entry = sampleEntry();
  assert.equal(classifyCacheFreshness(entry, 1_500), "hit");
  assert.equal(classifyCacheFreshness(entry, 2_500), "stale");
  assert.equal(classifyCacheFreshness(entry, 5_000), "miss");
});

test("toCacheGetResult maps statuses", () => {
  assert.equal(toCacheGetResult(undefined).status, "miss");
  assert.equal(toCacheGetResult(sampleEntry(), 1_500).status, "hit");
  assert.equal(toCacheGetResult(sampleEntry(), 3_000).status, "stale");
  assert.equal(toCacheGetResult(sampleEntry(), 9_000).status, "miss");
});
