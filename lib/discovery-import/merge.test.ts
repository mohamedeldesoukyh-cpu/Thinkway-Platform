import assert from "node:assert/strict";

import { isImportFieldEmpty, mergeMissingOnly, type ImportMergeLog } from "./merge";

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

function testMergeMissingOnlyPreservesExisting() {
  const logs: string[] = [];
  const log: ImportMergeLog = (_level, message) => {
    logs.push(message);
  };

  assert.equal(mergeMissingOnly(50_000, 10_000, "follower_count", log), 50_000);
  assert.ok(logs.some((m) => m.includes("field skipped") && m.includes("follower_count")));
}

function testMergeMissingOnlyFillsEmpty() {
  const logs: string[] = [];
  const log: ImportMergeLog = (_level, message) => {
    logs.push(message);
  };

  assert.equal(mergeMissingOnly(null, 10_000, "follower_count", log), 10_000);
  assert.ok(logs.some((m) => m.includes("field filled") && m.includes("follower_count")));
}

function testMergeMissingOnlySkipsEmptyIncoming() {
  assert.equal(mergeMissingOnly(null, null, "engagement_rate"), null);
  assert.deepEqual(mergeMissingOnly([], ["Fashion"], "categories"), ["Fashion"]);
}

function run() {
  testIsImportFieldEmpty();
  testMergeMissingOnlyPreservesExisting();
  testMergeMissingOnlyFillsEmpty();
  testMergeMissingOnlySkipsEmptyIncoming();
  console.log("lib/discovery-import/merge.test.ts — all tests passed");
}

run();
