import assert from "node:assert/strict";
import { normalizeCreatorCategoryChoices } from "./category-choices";
assert.deepEqual(normalizeCreatorCategoryChoices(["Chef", " chef ", "Food  Blogger", "Food Blogger", "", "Fitness"]), ["Chef", "Food Blogger", "Fitness"]);
assert.deepEqual(normalizeCreatorCategoryChoices(["Chef", "Food", "New niche"]), ["Chef", "Food", "New niche"]);
console.log("category-choices tests passed");
