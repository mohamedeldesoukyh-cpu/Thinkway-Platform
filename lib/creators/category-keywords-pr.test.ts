import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveCanonicalCategory } from "@/lib/creator-intelligence/taxonomy";
import { creatorMatchesBrowseCategories } from "./category-filter";
import {
  CREATOR_PR_CATEGORY,
  creatorHasPrCategory,
  withPrCategoryToggled,
} from "./category-keywords";

test("PR is a canonical category label", () => {
  assert.equal(resolveCanonicalCategory("PR"), "PR");
  assert.equal(resolveCanonicalCategory("pr"), "PR");
  assert.equal(resolveCanonicalCategory("public relations"), "PR");
});

test("creatorHasPrCategory is case-insensitive", () => {
  assert.equal(creatorHasPrCategory(["Beauty", "PR"]), true);
  assert.equal(creatorHasPrCategory(["pr"]), true);
  assert.equal(creatorHasPrCategory(["Beauty"]), false);
  assert.equal(creatorHasPrCategory([]), false);
});

test("withPrCategoryToggled adds and removes without replacing peers", () => {
  assert.deepEqual(withPrCategoryToggled(["Beauty", "Macro"], true), [
    CREATOR_PR_CATEGORY,
    "Beauty",
    "Macro",
  ]);
  assert.deepEqual(withPrCategoryToggled(["Beauty", "PR", "Food"], false), [
    "Beauty",
    "Food",
  ]);
  assert.deepEqual(withPrCategoryToggled(["pr", "Beauty"], true), [
    CREATOR_PR_CATEGORY,
    "Beauty",
  ]);
});

test("browse category filter matches PR tags", () => {
  assert.equal(
    creatorMatchesBrowseCategories(
      { categories: ["Beauty", "PR"], browse_category_tags: ["Beauty", "PR"] },
      ["PR"]
    ),
    true
  );
  assert.equal(
    creatorMatchesBrowseCategories(
      { categories: ["Beauty", "PR"], browse_category_tags: ["Beauty"] },
      ["PR"]
    ),
    true,
    "PR on categories must match even when browse snapshot lags"
  );
  assert.equal(
    creatorMatchesBrowseCategories(
      { categories: ["Beauty"], browse_category_tags: ["Beauty"] },
      ["PR"]
    ),
    false
  );
});
