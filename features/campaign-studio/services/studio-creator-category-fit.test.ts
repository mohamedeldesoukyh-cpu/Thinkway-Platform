import assert from "node:assert/strict";
import { test } from "node:test";

import {
  creatorFitsPreferredCategories,
  resolveStudioCreatorCategories,
} from "./studio-creator-category-fit";

const MASS_MIX = ["Sports", "Lifestyle", "Entertainment"];

test("abeer_kittchen infers Food from the kitchen handle", () => {
  assert.ok(
    resolveStudioCreatorCategories({
      handle: "abeer_kittchen",
      displayName: "Abeer Kitchen",
      categories: ["Lifestyle"],
    }).includes("Food")
  );
});

test("Beauty / Fashion / Fitness specialists do not count as a mass Sports mix", () => {
  assert.equal(
    creatorFitsPreferredCategories(
      { displayName: "Abeer Kitchen", categories: ["Beauty", "Fashion", "Fitness"] },
      MASS_MIX
    ),
    false
  );
  assert.equal(
    creatorFitsPreferredCategories(
      { categories: ["Beauty", "Fashion", "Fitness", "Entertainment"] },
      MASS_MIX
    ),
    false
  );
});

test("Food / kitchen creators do not count as Lifestyle on a mass Sports mix", () => {
  assert.equal(
    creatorFitsPreferredCategories(
      { handle: "abeer_kittchen", categories: ["Lifestyle"] },
      MASS_MIX
    ),
    false
  );
  assert.equal(
    creatorFitsPreferredCategories({ categories: ["Food", "Lifestyle"] }, MASS_MIX),
    false
  );
  assert.equal(
    creatorFitsPreferredCategories({ categories: ["Food"] }, MASS_MIX),
    false
  );
});

test("Sports, Entertainment, and Lifestyle-only creators stay on a mass mix", () => {
  assert.equal(creatorFitsPreferredCategories({ categories: ["Sports"] }, MASS_MIX), true);
  assert.equal(
    creatorFitsPreferredCategories({ categories: ["Entertainment"] }, MASS_MIX),
    true
  );
  assert.equal(creatorFitsPreferredCategories({ categories: ["Lifestyle"] }, MASS_MIX), true);
});

test("a Sports creator who also cooks still matches via Sports", () => {
  assert.equal(
    creatorFitsPreferredCategories({ categories: ["Sports", "Food"] }, MASS_MIX),
    true
  );
});

test("Food creators still match when Food is actually preferred", () => {
  assert.equal(
    creatorFitsPreferredCategories({ categories: ["Food"] }, ["Food", "Lifestyle"]),
    true
  );
});
