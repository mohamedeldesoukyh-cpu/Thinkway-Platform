import assert from "node:assert/strict";
import test from "node:test";

import { parseOrdinalIndex, resolveListOperation } from "./section-authoring-lists";

test("resolveListOperation reads the verb", () => {
  assert.equal(resolveListOperation("add another concept", false), "add");
  assert.equal(resolveListOperation("replace the creative concepts", false), "replace");
  assert.equal(resolveListOperation("remove this KPI", true), "remove");
  assert.equal(resolveListOperation("make the second concept stronger", true), "improve");
  assert.equal(resolveListOperation("improve it", false), "improve");
  // Bare list edit with no verb → refresh the whole list.
  assert.equal(resolveListOperation("the concepts", false), "replace");
});

test("parseOrdinalIndex maps ordinals to 0-based indices", () => {
  assert.equal(parseOrdinalIndex("make the first concept stronger"), 0);
  assert.equal(parseOrdinalIndex("improve the second one"), 1);
  assert.equal(parseOrdinalIndex("rewrite the third KPI"), 2);
  assert.equal(parseOrdinalIndex("rewrite the strategy"), undefined);
});
