import assert from "node:assert/strict";
import test from "node:test";

import {
  buildClientCacheKey,
  clientCacheKeyPrefix,
  hashStable,
  stableStringify,
} from "./keys";

test("stableStringify sorts object keys", () => {
  assert.equal(
    stableStringify({ b: 1, a: 2 }),
    stableStringify({ a: 2, b: 1 })
  );
});

test("hashStable is stable across key order", () => {
  assert.equal(hashStable({ page: 1, pageSize: 24 }), hashStable({ pageSize: 24, page: 1 }));
  assert.notEqual(hashStable({ page: 1 }), hashStable({ page: 2 }));
});

test("buildClientCacheKey uses canonical shape", () => {
  const key = buildClientCacheKey({
    schemaVersion: 1,
    userId: "user-1",
    namespace: "discovery",
    kind: "browse",
    fingerprint: "abc",
  });
  assert.equal(key, "tw:v1:user-1:discovery:browse:abc");
});

test("clientCacheKeyPrefix scopes by user + namespace (+ optional kind)", () => {
  assert.equal(
    clientCacheKeyPrefix({ schemaVersion: 1, userId: "u1", namespace: "discovery" }),
    "tw:v1:u1:discovery:"
  );
  assert.equal(
    clientCacheKeyPrefix({
      schemaVersion: 1,
      userId: "u1",
      namespace: "discovery",
      kind: "browse",
    }),
    "tw:v1:u1:discovery:browse:"
  );
});
