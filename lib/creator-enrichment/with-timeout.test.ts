import assert from "node:assert/strict";

import { withTimeout } from "./with-timeout";

async function neverResolves(): Promise<string> {
  return new Promise(() => {});
}

async function testResolvesBeforeTimeout() {
  const value = await withTimeout(Promise.resolve("ok"), 50, "fast");
  assert.equal(value, "ok");
}

async function testRejectsWhenOverTimeout() {
  await assert.rejects(
    () => withTimeout(neverResolves(), 20, "hung-redis"),
    /hung-redis timed out after 20ms/
  );
}

async function testPropagatesInnerFailure() {
  await assert.rejects(
    () => withTimeout(Promise.reject(new Error("redis down")), 50, "inner"),
    /redis down/
  );
}

async function run() {
  await testResolvesBeforeTimeout();
  await testRejectsWhenOverTimeout();
  await testPropagatesInnerFailure();
  console.log("lib/creator-enrichment/with-timeout.test.ts — all tests passed");
}

void run();
