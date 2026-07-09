import assert from "node:assert/strict";
import test from "node:test";

import {
  CREATOR_CATEGORY_UNCATEGORIZED,
  CREATOR_SEARCH_CATEGORY_PARAM,
  applyCategoriesToUrlParams,
  buildCreatorSearchHref,
  categoriesEqual,
  categoriesFromUrlParams,
  categoryFilterFromUrlParam,
  categoryFilterLabel,
  creatorBrowseCategoryTags,
  creatorIsUncategorized,
  creatorMatchesBrowseCategories,
  creatorStoredCategoriesForDisplay,
  isUncategorizedCategoryFilter,
  normalizeCategoryList,
  removeCategoryFromList,
  shouldUseUnifiedBrowseIndexPath,
  toggleCategoryInList,
} from "./category-filter";

test("buildCreatorSearchHref encodes category values", () => {
  assert.equal(buildCreatorSearchHref(), "/discovery/search");
  assert.equal(
    buildCreatorSearchHref("Beauty & Wellness"),
    `/discovery/search?${CREATOR_SEARCH_CATEGORY_PARAM}=Beauty%20%26%20Wellness`
  );
  assert.equal(
    buildCreatorSearchHref([CREATOR_CATEGORY_UNCATEGORIZED, "Beauty"]),
    `/discovery/search?${CREATOR_SEARCH_CATEGORY_PARAM}=${encodeURIComponent(CREATOR_CATEGORY_UNCATEGORIZED)}&${CREATOR_SEARCH_CATEGORY_PARAM}=Beauty`
  );
});

test("categoriesFromUrlParams reads repeated category keys", () => {
  const params = new URLSearchParams();
  params.append(CREATOR_SEARCH_CATEGORY_PARAM, "Beauty");
  params.append(CREATOR_SEARCH_CATEGORY_PARAM, "Fashion");
  assert.deepEqual(categoriesFromUrlParams(params), ["Beauty", "Fashion"]);
});

test("toggle and remove category lists", () => {
  assert.deepEqual(toggleCategoryInList(["Beauty"], "Beauty"), []);
  assert.deepEqual(toggleCategoryInList([], "Beauty"), ["Beauty"]);
  assert.deepEqual(removeCategoryFromList(["Beauty", "Fashion"], "Beauty"), ["Fashion"]);
});

test("categoriesEqual compares order independently", () => {
  assert.equal(categoriesEqual(["Beauty", "Fashion"], ["Fashion", "Beauty"]), true);
  assert.equal(categoriesEqual(["Beauty"], ["Fashion"]), false);
});

test("applyCategoriesToUrlParams writes repeated keys", () => {
  const params = new URLSearchParams("q=test");
  applyCategoriesToUrlParams(params, ["Beauty", "Fashion"]);
  assert.equal(params.get("q"), "test");
  assert.deepEqual(params.getAll(CREATOR_SEARCH_CATEGORY_PARAM), ["Beauty", "Fashion"]);
});

test("uncategorized helpers", () => {
  assert.equal(isUncategorizedCategoryFilter(CREATOR_CATEGORY_UNCATEGORIZED), true);
  assert.equal(isUncategorizedCategoryFilter("Beauty"), false);
  assert.equal(categoryFilterLabel(CREATOR_CATEGORY_UNCATEGORIZED), "Uncategorized");
  assert.equal(categoryFilterFromUrlParam("  Beauty  "), "Beauty");
  assert.equal(creatorIsUncategorized({ categories: [] }), true);
  assert.equal(creatorIsUncategorized({ categories: ["Beauty"] }), false);
});

test("creatorMatchesBrowseCategories uses OR semantics", () => {
  const creator = { browse_category_tags: ["Beauty"] };
  assert.equal(creatorMatchesBrowseCategories(creator, []), true);
  assert.equal(creatorMatchesBrowseCategories(creator, ["Beauty"]), true);
  assert.equal(creatorMatchesBrowseCategories(creator, ["Fashion"]), false);
  assert.equal(creatorMatchesBrowseCategories(creator, ["Fashion", "Beauty"]), true);
  assert.equal(
    creatorMatchesBrowseCategories({ browse_category_tags: [] }, [CREATOR_CATEGORY_UNCATEGORIZED]),
    true
  );
});

test("creatorMatchesBrowseCategories matches platform interest tags", () => {
  const creator = {
    browse_category_tags: [],
    audience_interests: ["Beauty", "Skincare"],
  };
  assert.equal(creatorMatchesBrowseCategories(creator, ["Beauty"]), true);
  assert.equal(creatorMatchesBrowseCategories(creator, ["Fashion"]), false);
});

test("creatorMatchesBrowseCategories ignores merged display categories", () => {
  const creator = {
    browse_category_tags: ["Food Pro"],
    categories: ["Food Pro", "Beauty", "Comedy"],
  };
  assert.equal(creatorMatchesBrowseCategories(creator, ["Food Pro"]), true);
  assert.equal(creatorMatchesBrowseCategories(creator, ["Beauty"]), false);
});

test("creatorMatchesBrowseCategories is case-insensitive", () => {
  assert.equal(
    creatorMatchesBrowseCategories({ browse_category_tags: ["food pro"] }, ["Food Pro"]),
    true
  );
});

test("creatorBrowseCategoryTags prefers stored browse tags", () => {
  assert.deepEqual(
    creatorBrowseCategoryTags({
      browse_category_tags: ["Food Pro"],
      categories: ["Beauty"],
    }),
    ["Food Pro"]
  );
});

test("shouldUseUnifiedBrowseIndexPath skips category-filtered browse", () => {
  assert.equal(shouldUseUnifiedBrowseIndexPath({}), true);
  assert.equal(shouldUseUnifiedBrowseIndexPath({ search: "food" }), false);
  assert.equal(shouldUseUnifiedBrowseIndexPath({ source: "internal" }), false);
  assert.equal(
    shouldUseUnifiedBrowseIndexPath({ categories: ["Food Pro"] }),
    false
  );
});

test("creatorStoredCategoriesForDisplay prefers browse tags", () => {
  assert.deepEqual(
    creatorStoredCategoriesForDisplay({
      browse_category_tags: ["Food Pro"],
      categories: ["Beauty", "Camera & Photography"],
    }),
    ["Food Pro"]
  );
});

test("normalizeCategoryList deduplicates", () => {
  assert.deepEqual(normalizeCategoryList(["Beauty", "Beauty", " Fashion "]), [
    "Beauty",
    "Fashion",
  ]);
});
