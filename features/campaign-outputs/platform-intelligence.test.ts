import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  buildPlatformIntelligenceNarrative,
  sortedPlatformIntelligence,
} from "@/features/campaign-outputs/platform-intelligence";

test("platform intelligence covers every quotation platform including mirrors", () => {
  const allocation = {
    TikTok: 5,
    Instagram: 3,
    Facebook: 2,
    YouTube: 1,
    Snapchat: 1,
  };

  const entries = sortedPlatformIntelligence(allocation);
  assert.equal(entries.length, 5);
  assert.deepEqual(
    entries.map((entry) => entry.platform).sort(),
    ["Facebook", "Instagram", "Snapchat", "TikTok", "YouTube"]
  );

  const narrative = buildPlatformIntelligenceNarrative({
    platformAllocation: allocation,
    audience: "Gen Z 16–24",
  });

  for (const platform of ["TikTok", "Instagram", "Facebook", "YouTube", "Snapchat"]) {
    assert.match(narrative, new RegExp(platform, "i"), `expected ${platform} in intelligence narrative`);
  }
  assert.match(narrative, /quotation-driven|quoted deliverable/i);
  assert.doesNotMatch(narrative, /IG\/TikTok only/i);
});

test("single-platform allocation still receives role and audience rationale", () => {
  const narrative = buildPlatformIntelligenceNarrative({
    platformAllocation: { YouTube: 4 },
    audience: "Parents 30–45",
  });

  assert.match(narrative, /YouTube/i);
  assert.match(narrative, /search|consideration|depth/i);
});
