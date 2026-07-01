import assert from "node:assert/strict";

import { isImportFieldEmpty, mergeAuthoritative, type ImportMergeLog } from "./merge";

function testIsImportFieldEmpty() {
  assert.equal(isImportFieldEmpty(null), true);
  assert.equal(isImportFieldEmpty(undefined), true);
  assert.equal(isImportFieldEmpty(""), true);
  assert.equal(isImportFieldEmpty("  "), true);
  assert.equal(isImportFieldEmpty([]), true);
  assert.equal(isImportFieldEmpty({}), true);
  assert.equal(isImportFieldEmpty(0), false);
  assert.equal(isImportFieldEmpty("value"), false);
  assert.equal(isImportFieldEmpty(["a"]), false);
}

function testMergeAuthoritativeOverwritesExisting() {
  const logs: string[] = [];
  const log: ImportMergeLog = (_level, message) => {
    logs.push(message);
  };

  assert.equal(mergeAuthoritative(50_000, 10_000, "follower_count", log), 10_000);
  assert.ok(logs.some((m) => m.includes("field updated") && m.includes("follower_count")));
}

function testMergeAuthoritativeFillsEmpty() {
  const logs: string[] = [];
  const log: ImportMergeLog = (_level, message) => {
    logs.push(message);
  };

  assert.equal(mergeAuthoritative(null, 10_000, "follower_count", log), 10_000);
  assert.ok(logs.some((m) => m.includes("field updated") && m.includes("follower_count")));
}

function testMergeAuthoritativePreservesWhenIncomingEmpty() {
  const logs: string[] = [];
  const log: ImportMergeLog = (_level, message) => {
    logs.push(message);
  };

  assert.equal(mergeAuthoritative(50_000, null, "follower_count", log), 50_000);
  assert.ok(logs.some((m) => m.includes("field skipped") && m.includes("follower_count")));
  assert.deepEqual(mergeAuthoritative(["Beauty"], [], "categories", log), ["Beauty"]);
}

function run() {
  testIsImportFieldEmpty();
  testMergeAuthoritativeOverwritesExisting();
  testMergeAuthoritativeFillsEmpty();
  testMergeAuthoritativePreservesWhenIncomingEmpty();
  console.log("lib/discovery-import/merge.test.ts — all tests passed");
}

run();
