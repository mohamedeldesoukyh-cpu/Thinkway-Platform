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
  industry: "Banking",
  extractedAt: "",
  confidence: {},
  sources: {},
};

test("requirement score prefers creators who meet every campaign fact", () => {
  const complete = studioCreatorRequirementScore(
    { countryCode: "EG", platform: "Instagram", category: "Banking" },
    egyptFacts
  );
  const missingCategory = studioCreatorRequirementScore(
    { countryCode: "EG", platform: "Instagram", category: "Beauty" },
    egyptFacts
  );
  const missingMost = studioCreatorRequirementScore(
    { countryCode: "AE", platform: "TikTok", category: "Beauty" },
    egyptFacts
  );

  assert.equal(complete.met, 3);
  assert.equal(complete.total, 3);
  assert.ok(compareStudioRequirementScores(complete, missingCategory) < 0);
  assert.ok(compareStudioRequirementScores(missingCategory, missingMost) < 0);
});

test("sorts complete requirements ahead of partial matches", () => {
  const ranked = sortByStudioRequirements(
    [
      { name: "partial", countryCode: "EG", platform: "TikTok", category: "Banking" },
      { name: "complete", countryCode: "EG", platform: "Instagram", category: "Banking" },
      { name: "weak", countryCode: "EG", platform: "TikTok", category: "Beauty" },
    ],
    (item) => studioCreatorRequirementScore(item, egyptFacts)
  );

  assert.deepEqual(
    ranked.map((item) => item.name),
    ["complete", "partial", "weak"]
  );
});
