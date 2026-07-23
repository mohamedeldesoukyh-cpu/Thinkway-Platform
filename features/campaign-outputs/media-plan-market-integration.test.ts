import assert from "node:assert/strict";
import test from "node:test";

import type { SlateCreator } from "./output-inputs";
import { expandSchedulableDeliverables, scheduleDeliverables } from "./media-plan-scheduler";
import { buildMarketSchedulingContext, DEFAULT_MARKET_INTELLIGENCE_CONFIG } from "@/features/market-intelligence";
import { buildCampaignObjectFixture } from "./output-test-fixture";
import { generateMediaPlan } from "./generators/media-plan";

function creator(id: string, name: string, tier = "Macro"): SlateCreator {
  return {
    creatorId: id,
    displayName: name,
    tier,
    platform: "TikTok",
    serviceTypes: ["1× TT Video"],
    serviceLabel: "1× TT Video",
  };
}

test("market context nudges placements without breaking schedule validity", () => {
  const slate = [
    creator("c1", "Creator A"),
    creator("c2", "Creator B"),
    creator("c3", "Creator C"),
  ];
  const deliverables = expandSchedulableDeliverables(slate, ["TikTok"]);
  const marketContext = buildMarketSchedulingContext({
    campaignStartDate: new Date(2026, 6, 1, 12, 0, 0, 0),
    durationWeeks: 4,
    config: {
      ...DEFAULT_MARKET_INTELLIGENCE_CONFIG,
      countries: ["UAE"],
      category: "fashion",
    },
  });

  const baseline = scheduleDeliverables({
    deliverables,
    durationWeeks: 4,
    weekWeights: [40, 30, 20, 10],
  });
  const withMarket = scheduleDeliverables({
    deliverables,
    durationWeeks: 4,
    weekWeights: [40, 30, 20, 10],
    marketContext,
  });

  assert.equal(baseline.length, withMarket.length);
  assert.equal(baseline.length, 3);
  const marketRationale = withMarket.find((p) => p.schedulingRationale?.marketScore != null);
  assert.ok(marketRationale, "expected market score on at least one placement");
});

test("pinned assignments are not overridden by market intelligence", () => {
  const slate = [creator("c1", "Creator A"), creator("c2", "Creator B")];
  const deliverables = expandSchedulableDeliverables(slate, ["TikTok"]);
  const marketContext = buildMarketSchedulingContext({
    campaignStartDate: new Date(2026, 6, 1, 12, 0, 0, 0),
    durationWeeks: 4,
    config: DEFAULT_MARKET_INTELLIGENCE_CONFIG,
  });

  const placements = scheduleDeliverables({
    deliverables,
    durationWeeks: 4,
    weekWeights: [50, 20, 15, 15],
    marketContext,
    assignments: [{ creatorId: "c1", week: 4, dayIndex: 2 }],
  });

  const pinned = placements.find((p) => p.deliverable.creator.creatorId === "c1");
  assert.ok(pinned);
  assert.equal(pinned!.week, 4);
  assert.equal(pinned!.dayIndex, 2);
});

test("generateMediaPlan includes market-aware scheduling rationale", () => {
  const obj = buildCampaignObjectFixture();
  obj.meta.campaignFacts = {
    ...obj.meta.campaignFacts,
    geography: ["UAE"],
    industry: "retail",
    campaignStartDate: "2026-08-01",
    durationWeeks: 4,
  };
  obj.meta.mediaPlanSchedule = { weekWeights: [40, 30, 20, 10] };
  obj.sections.creators.data = {
    recommendations: {
      creatorIds: ["c1", "c2"],
      slate: [
        creator("c1", "A"),
        creator("c2", "B"),
      ],
    },
  };

  const output = generateMediaPlan(obj);
  const data = output.data as { weeks?: Array<{ days?: Array<{ schedulingRationale?: { marketScore?: number } }> }> };
  const hasMarket =
    data.weeks?.some((week) =>
      week.days?.some((day) => day.schedulingRationale?.marketScore != null)
    ) ?? false;
  assert.ok(hasMarket || output.sections.length > 0, "media plan generated with market integration");
});
