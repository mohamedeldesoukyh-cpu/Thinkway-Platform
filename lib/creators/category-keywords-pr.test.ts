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
    "Beauty",
    "Macro",
    CREATOR_PR_CATEGORY,
  ]);
  assert.deepEqual(withPrCategoryToggled(["Beauty", "PR", "Food"], false), [
    "Beauty",
    "Food",
  ]);
  assert.deepEqual(withPrCategoryToggled(["pr", "Beauty"], true), [
    "Beauty",
    CREATOR_PR_CATEGORY,
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
      { categories: ["Beauty"], browse_category_tags: ["Beauty"] },
      ["PR"]
    ),
    false
  );
});
