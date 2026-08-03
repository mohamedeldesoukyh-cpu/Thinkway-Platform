import assert from "node:assert/strict";
import { test } from "node:test";

import { preferCategoryBrowseOverKeywordSearch } from "./search-creators-from-profile";

test("clears FTS search when preferred categories are present", () => {
  const next = preferCategoryBrowseOverKeywordSearch({
    search: "5G",
    categories: ["Travel", "Beauty"],
  });
  assert.equal(next.search, undefined);
  assert.deepEqual(next.categories, ["Travel", "Beauty"]);
});

test("keeps FTS search when categories are absent", () => {
  const next = preferCategoryBrowseOverKeywordSearch({
    search: "5G",
    categories: [],
  });
  assert.equal(next.search, "5G");
});
