import assert from "node:assert/strict";
import { test } from "node:test";

import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";

import {
  compareStudioRequirementScores,
  sortByStudioRequirements,
  studioCreatorRequirementScore,
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
