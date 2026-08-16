import assert from "node:assert/strict";
import { test } from "node:test";

import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";

import {
  compareStudioRequirementScores,
  sortByStudioRequirements,
  studioCreatorRequirementScore,
  vendorFitsStudioBriefMix,
} from "./studio-creator-requirements";

const egyptFacts: CampaignFacts = {
  geography: ["Egypt"],
  platforms: ["Instagram"],
  industry: "Finance & Banking",
  product: "Credit Card Instant Issuance",
  objective: "Drive awareness of Credit Card Instant Issuance and acquire new bank customers",
  audience: "mass audience",
  rawBriefExcerpt:
    "Arab Bank credit card instant issuance. Targeting a mass audience. Similar approach and strong mix as the previous LaLiga event.",
  extractedAt: "",
  confidence: {},
  sources: {},
};

test("requirement score prefers creators who meet market, platform, and brief mix — not client industry", () => {
  const complete = studioCreatorRequirementScore(
    { countryCode: "EG", platform: "Instagram", category: "Sports" },
    egyptFacts
  );
  const financeOnly = studioCreatorRequirementScore(
    { countryCode: "EG", platform: "Instagram", category: "Banking" },
    egyptFacts
  );
  const missingMost = studioCreatorRequirementScore(
    { countryCode: "AE", platform: "TikTok", category: "Beauty" },
    egyptFacts
  );

  assert.equal(complete.met, 3);
  assert.equal(complete.total, 3);
  assert.equal(financeOnly.met, 2);
  assert.equal(financeOnly.total, 3);
  assert.ok(compareStudioRequirementScores(complete, financeOnly) < 0);
  assert.ok(compareStudioRequirementScores(financeOnly, missingMost) < 0);
});

test("sorts complete requirements ahead of partial matches", () => {
  const ranked = sortByStudioRequirements(
    [
      { name: "partial", countryCode: "EG", platform: "TikTok", category: "Sports" },
      { name: "complete", countryCode: "EG", platform: "Instagram", category: "Sports" },
      { name: "weak", countryCode: "AE", platform: "TikTok", category: "Banking" },
    ],
    (item) => studioCreatorRequirementScore(item, egyptFacts)
  );

  assert.deepEqual(
    ranked.map((item) => item.name),
    ["complete", "partial", "weak"]
  );
});

test("kitchen / Food creators do not get the brief-mix requirement on a LaLiga-style slate", () => {
  const sports = studioCreatorRequirementScore(
    { countryCode: "EG", platform: "Instagram", categories: ["Sports"] },
    egyptFacts
  );
  const kitchen = studioCreatorRequirementScore(
    {
      countryCode: "EG",
      platform: "Instagram",
      handle: "abeer_kittchen",
      categories: ["Lifestyle"],
    },
    egyptFacts
  );

  assert.equal(sports.met, 3);
  assert.equal(kitchen.met, 2);
  assert.ok(compareStudioRequirementScores(sports, kitchen) < 0);

  const ranked = sortByStudioRequirements(
    [
      { name: "abeer_kittchen", countryCode: "EG", platform: "Instagram", handle: "abeer_kittchen" },
      { name: "sports-fit", countryCode: "EG", platform: "Instagram", categories: ["Sports"] },
    ],
    (item) => studioCreatorRequirementScore(item, egyptFacts)
  );
  assert.equal(ranked[0]?.name, "sports-fit");
});

test("Abeer Kitchen Beauty/Fashion/Fitness is excluded from the Arab Bank recommended mix", () => {
  assert.equal(
    vendorFitsStudioBriefMix(
      {
        displayName: "Abeer Kitchen",
        handle: "abeer_kittchen",
        categories: ["Beauty", "Fashion", "Fitness"],
      },
      egyptFacts
    ),
    false
  );
  assert.equal(
    vendorFitsStudioBriefMix({ categories: ["Sports"] }, egyptFacts),
    true
  );
});
