import assert from "node:assert/strict";
import test from "node:test";

import "fake-indexeddb/auto";

import {
  getClientCacheEntry,
  resetClientCacheDbForTests,
  setClientCacheEntry,
} from "@/lib/client-cache";

import {
  buildDiscoveryBrowseCacheKey,
  discoveryCreatorEntityTag,
  fingerprintDiscoveryBrowseParams,
  invalidateDiscoveryBrowseCache,
  invalidateDiscoveryBrowseCacheForCreator,
} from "./discovery-browse-cache";

test.beforeEach(async () => {
  await resetClientCacheDbForTests();
});

test("browse cache key includes user, page, pageSize, productionOnly", () => {
  const a = buildDiscoveryBrowseCacheKey({
    userId: "user-a",
    browseParams: { page: 1, pageSize: 24, productionOnly: true, search: "x" },
  });
  const b = buildDiscoveryBrowseCacheKey({
    userId: "user-b",
    browseParams: { page: 1, pageSize: 24, productionOnly: true, search: "x" },
  });
  const page2 = buildDiscoveryBrowseCacheKey({
    userId: "user-a",
    browseParams: { page: 2, pageSize: 24, productionOnly: true, search: "x" },
  });
  assert.notEqual(a, b);
  assert.notEqual(a, page2);
  assert.match(a, /^tw:v1:user-a:discovery:browse:/);
});

test("fingerprint ignores searchSessionId and skipCoverageBackfill", () => {
  const base = { page: 1, pageSize: 24, productionOnly: true as const, search: "cairo" };
  assert.equal(
    fingerprintDiscoveryBrowseParams(base),
    fingerprintDiscoveryBrowseParams({
      ...base,
      searchSessionId: "sess-1",
      skipCoverageBackfill: true,
    } as typeof base & { searchSessionId: string; skipCoverageBackfill: boolean })
  );
});

test("discoveryCreatorEntityTag matches browse write tags", () => {
  assert.equal(discoveryCreatorEntityTag("inf:abc"), "entity:creator:inf:abc");
  assert.equal(discoveryCreatorEntityTag("  inf:abc  "), "entity:creator:inf:abc");
});

test("invalidateDiscoveryBrowseCacheForCreator removes tagged browse pages only", async () => {
  await setClientCacheEntry(
    "tw:v1:u1:discovery:browse:hit",
    { n: 1 },
    {
      namespace: "discovery",
      kind: "browse",
      softTtlMs: 60_000,
      hardTtlMs: 120_000,
      tags: [discoveryCreatorEntityTag("c1"), "discovery:browse"],
    }
  );
  await setClientCacheEntry(
    "tw:v1:u1:discovery:browse:other",
    { n: 2 },
    {
      namespace: "discovery",
      kind: "browse",
      softTtlMs: 60_000,
      hardTtlMs: 120_000,
      tags: ["discovery:browse"],
    }
  );

  const removed = await invalidateDiscoveryBrowseCacheForCreator("c1");
  assert.equal(removed, 1);
  assert.equal((await getClientCacheEntry("tw:v1:u1:discovery:browse:hit")).status, "miss");
  assert.equal((await getClientCacheEntry("tw:v1:u1:discovery:browse:other")).status, "hit");
});

test("invalidateDiscoveryBrowseCache drops user browse prefix", async () => {
  await setClientCacheEntry(
    "tw:v1:u1:discovery:browse:a",
    { n: 1 },
    { namespace: "discovery", kind: "browse", softTtlMs: 60_000, hardTtlMs: 120_000 }
  );
  await setClientCacheEntry(
    "tw:v1:u2:discovery:browse:a",
    { n: 2 },
    { namespace: "discovery", kind: "browse", softTtlMs: 60_000, hardTtlMs: 120_000 }
  );

  assert.equal(await invalidateDiscoveryBrowseCache("u1"), 1);
  assert.equal((await getClientCacheEntry("tw:v1:u1:discovery:browse:a")).status, "miss");
  assert.equal((await getClientCacheEntry("tw:v1:u2:discovery:browse:a")).status, "hit");
});
