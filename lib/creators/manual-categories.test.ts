import assert from "node:assert/strict";
import { test } from "node:test";
import { refreshedManualCategories } from "./manual-categories";
test("empty or non-category refresh preserves manual categories", () => {
 assert.deepEqual(refreshedManualCategories(["Food"], []), ["Food"]);
 assert.deepEqual(refreshedManualCategories(["Food"], ["Digital Creator"]), ["Food"]);
 assert.deepEqual(refreshedManualCategories([], []), []);
});
test("real provider categories replace manual choices, preserving PR", () => {
 assert.deepEqual(refreshedManualCategories(["Fashion", "PR"], ["Food", "food"]), ["Food", "PR"]);
});

test("provider refresh preserves manual UGC and PR classifications", () => {
 assert.deepEqual(refreshedManualCategories(["UGC", "PR", "Fashion"], ["Food"]), ["Food", "UGC", "PR"]);
});
