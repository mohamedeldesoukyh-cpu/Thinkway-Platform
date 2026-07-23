import { strict as assert } from "node:assert";
import { test } from "node:test";

import { buildCampaignObjectFixture } from "@/features/campaign-outputs/output-test-fixture";
import { buildMediaPlanStrategyNarrative } from "@/features/campaign-outputs/media-plan-strategy-narrative";
import {
  buildMarketSchedulingContext,
  buildMarketTimingRationale,
  DEFAULT_MARKET_INTELLIGENCE_CONFIG,
} from "@/features/market-intelligence";

test("strategy narrative includes market timing intelligence for UAE campaign", () => {
  const obj = buildCampaignObjectFixture();
  obj.meta.campaignFacts = {
    ...obj.meta.campaignFacts,
    geography: ["UAE"],
    industry: "beauty",
    campaignStartDate: "2026-11-01",
    objective: "Drive conversion during White Friday",
  };

  const narrative = buildMediaPlanStrategyNarrative({
    weekWeights: [35, 35, 20, 10],
    durationWeeks: 4,
    platformAllocation: { Instagram: 4, TikTok: 4 },
    slate: [],
    briefText: "Beauty launch for UAE market — align with salary week and White Friday.",
    objective: "Drive conversion during White Friday",
    campaignObject: obj,
    campaignStartDate: "2026-11-01",
  });

  assert.ok(narrative.marketTimingIntelligence);
  assert.match(narrative.marketTimingIntelligence!, /UAE|market|salary|retail|White Friday/i);
  assert.equal(narrative.marketTimingConfidence?.level, "high");
});

test("buildMarketTimingRationale explains Ramadan when in flight", () => {
  const context = buildMarketSchedulingContext({
    campaignStartDate: new Date(2026, 1, 15, 12, 0, 0, 0),
    durationWeeks: 6,
    config: {
      ...DEFAULT_MARKET_INTELLIGENCE_CONFIG,
      countries: ["Saudi Arabia"],
      category: "food",
    },
  });
  const text = buildMarketTimingRationale({
    context,
    weekWeights: [30, 25, 20, 15, 5, 5],
    durationWeeks: 6,
  });
  assert.match(text, /Ramadan|Eid|market intelligence/i);
});
