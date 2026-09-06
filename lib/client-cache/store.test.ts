import "fake-indexeddb/auto";

import assert from "node:assert/strict";
import test from "node:test";

import { openClientCacheDb, resetClientCacheDbForTests } from "./db";
import {
  clearClientCacheEntries,
  deleteClientCacheEntry,
  getClientCacheEntry,
  setClientCacheEntry,
} from "./store";

test.beforeEach(async () => {
  await resetClientCacheDbForTests();
});

test("get/set/delete round-trip", async () => {
  const key = "tw:v1:u:discovery:browse:t1";
  const ok = await setClientCacheEntry(
    key,
    { creators: [{ id: "a" }], total: 1 },
    {
      namespace: "discovery",
      kind: "browse",
      softTtlMs: 60_000,
      hardTtlMs: 120_000,
      tags: ["discovery:browse"],
    }
  );
  assert.equal(ok, true);

  const hit = await getClientCacheEntry<{ creators: Array<{ id: string }>; total: number }>(
    key
  );
  assert.equal(hit.status, "hit");
  if (hit.status !== "hit") throw new Error("expected hit");
  assert.equal(hit.entry.payload.total, 1);
  assert.equal(hit.entry.payload.creators[0]?.id, "a");

  await deleteClientCacheEntry(key);
  const miss = await getClientCacheEntry(key);
  assert.equal(miss.status, "miss");
});

test("soft-stale returns stale; hard-expired is miss", async () => {
  const key = "tw:v1:u:discovery:browse:ttl";
  const now = 1_000_000;
  await setClientCacheEntry(
    key,
    { total: 2 },
    {
      namespace: "discovery",
      kind: "browse",
      softTtlMs: 1_000,
      hardTtlMs: 5_000,
      now,
    }
  );

  const stale = await getClientCacheEntry(key, now + 2_000);
  assert.equal(stale.status, "stale");

  const miss = await getClientCacheEntry(key, now + 6_000);
  assert.equal(miss.status, "miss");
});

test("openClientCacheDb returns a handle when IndexedDB is available", async () => {
  const db = await openClientCacheDb();
  assert.ok(db);
  await clearClientCacheEntries();
});
