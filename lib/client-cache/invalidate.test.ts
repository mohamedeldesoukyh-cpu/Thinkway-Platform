import "fake-indexeddb/auto";

import assert from "node:assert/strict";
import test from "node:test";

import { resetClientCacheDbForTests } from "./db";
import {
  invalidateClientCacheByPrefix,
  invalidateClientCacheByTag,
} from "./invalidate";
import { getClientCacheEntry, setClientCacheEntry } from "./store";

test.beforeEach(async () => {
  await resetClientCacheDbForTests();
});

test("invalidate by prefix removes matching keys only", async () => {
  await setClientCacheEntry(
    "tw:v1:u1:discovery:browse:a",
    { n: 1 },
    { namespace: "discovery", kind: "browse", softTtlMs: 60_000, hardTtlMs: 120_000 }
  );
  await setClientCacheEntry(
    "tw:v1:u1:discovery:browse:b",
    { n: 2 },
    { namespace: "discovery", kind: "browse", softTtlMs: 60_000, hardTtlMs: 120_000 }
  );
  await setClientCacheEntry(
    "tw:v1:u2:discovery:browse:a",
    { n: 3 },
    { namespace: "discovery", kind: "browse", softTtlMs: 60_000, hardTtlMs: 120_000 }
  );

  const removed = await invalidateClientCacheByPrefix("tw:v1:u1:discovery:browse:");
  assert.equal(removed, 2);
  assert.equal((await getClientCacheEntry("tw:v1:u1:discovery:browse:a")).status, "miss");
  assert.equal((await getClientCacheEntry("tw:v1:u2:discovery:browse:a")).status, "hit");
});

test("invalidate by tag removes tagged entries", async () => {
  await setClientCacheEntry(
    "tw:v1:u1:discovery:browse:t",
    { n: 1 },
    {
      namespace: "discovery",
      kind: "browse",
      softTtlMs: 60_000,
      hardTtlMs: 120_000,
      tags: ["entity:creator:c1", "discovery:browse"],
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

  const removed = await invalidateClientCacheByTag("entity:creator:c1");
  assert.equal(removed, 1);
  assert.equal((await getClientCacheEntry("tw:v1:u1:discovery:browse:t")).status, "miss");
  assert.equal((await getClientCacheEntry("tw:v1:u1:discovery:browse:other")).status, "hit");
});
