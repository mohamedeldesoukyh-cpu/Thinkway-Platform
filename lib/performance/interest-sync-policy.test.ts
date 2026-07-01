import assert from "node:assert/strict";

import {
  coalesceInterestArrayValues,
  isEmptyInterestValue,
  isInterestMergeEnabled,
  mergeInterestStringArrays,
  resolveInterestFieldMerge,
} from "@/lib/performance/interest-sync-policy";

assert.equal(isEmptyInterestValue(null), true);
assert.equal(isEmptyInterestValue(""), true);
assert.equal(isEmptyInterestValue([]), true);
assert.equal(isEmptyInterestValue([""]), true);
assert.equal(isEmptyInterestValue(["unknown"]), true);
assert.equal(isEmptyInterestValue(["n/a"]), true);
assert.equal(isEmptyInterestValue(["Beauty & Cosmetics"]), false);

assert.deepEqual(
  mergeInterestStringArrays(["Beauty", "Fashion"], ["Beauty", "Travel"]),
  ["Beauty", "Fashion", "Travel"]
);

assert.deepEqual(
  coalesceInterestArrayValues([], null, ["Camera & Photography"]),
  ["Camera & Photography"]
);

// Scenario A: import ["Beauty","Fashion"], refresh, provider [] → unchanged
{
  const result = resolveInterestFieldMerge({
    field: "interest_categories",
    existingValue: ["Beauty", "Fashion"],
    existingSource: "imported",
    incomingValue: [],
    incomingSource: "apify",
  });
  assert.equal(result.action, "preserve");
  assert.match(result.log ?? "", /provider returned empty interests/);
}

// Scenario B: import ["Beauty"], provider ["Beauty","Travel"] → unchanged by default
{
  const result = resolveInterestFieldMerge({
    field: "interest_categories",
    existingValue: ["Beauty"],
    existingSource: "imported",
    incomingValue: ["Beauty", "Travel"],
    incomingSource: "apify",
  });
  assert.equal(result.action, "preserve");
  assert.match(result.log ?? "", /preserving imported interests/);
}

// Scenario C: forceInterestReplace=true → provider replaces
{
  const result = resolveInterestFieldMerge({
    field: "interest_categories",
    existingValue: ["Beauty"],
    existingSource: "imported",
    incomingValue: ["Beauty", "Travel"],
    incomingSource: "apify",
    forceInterestReplace: true,
  });
  assert.equal(result.action, "write");
  assert.deepEqual(result.value, ["Beauty", "Travel"]);
  assert.match(result.log ?? "", /replaced interests \(force=true\)/);
}

// ENABLE_INTEREST_MERGE=true merges genuinely new interests
{
  const previous = process.env.ENABLE_INTEREST_MERGE;
  process.env.ENABLE_INTEREST_MERGE = "true";
  assert.equal(isInterestMergeEnabled(), true);

  const result = resolveInterestFieldMerge({
    field: "interest_categories",
    existingValue: ["Beauty", "Fashion"],
    existingSource: "apify",
    incomingValue: ["Beauty", "Travel"],
    incomingSource: "apify",
    enableInterestMerge: true,
  });
  assert.equal(result.action, "write");
  assert.deepEqual(result.value, ["Beauty", "Fashion", "Travel"]);
  assert.match(result.log ?? "", /merged new interests/);

  process.env.ENABLE_INTEREST_MERGE = previous;
}

// Empty existing accepts provider data
{
  const result = resolveInterestFieldMerge({
    field: "audience_country",
    existingValue: null,
    existingSource: undefined,
    incomingValue: "AE",
    incomingSource: "apify",
  });
  assert.equal(result.action, "write");
  assert.equal(result.value, "AE");
}

console.log("interest-sync-policy tests passed");
