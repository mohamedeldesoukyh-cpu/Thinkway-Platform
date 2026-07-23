import { strict as assert } from "node:assert";
import { test } from "node:test";

import { buildCampaignObjectFixture } from "@/features/campaign-outputs/output-test-fixture";
import {
  applyMediaPlanScheduleChange,
  mergeMediaPlanMarketIntelligenceMeta,
} from "@/features/campaign-outputs/media-plan-schedule";
import { resolveMarketIntelligenceConfig } from "@/features/market-intelligence/market-intelligence-config";

test("applyMediaPlanScheduleChange preserves marketIntelligence and priorityWeights on moves", () => {
  const object = buildCampaignObjectFixture();
  object.meta.mediaPlanSchedule = {
    weekWeights: [40, 30, 20, 10],
    priorityWeights: {
      objectives: {
        awareness: { performance: 0.5, audience: 0.2, creatorQuality: 0.15, campaignFit: 0.15 },
      },
    },
    marketIntelligence: {
      enabled: true,
      toggles: { salaryCycle: false, ramadan: true },
    },
  };

  const result = applyMediaPlanScheduleChange(object, {
    moveCreators: [{ creatorIds: ["cr_star"], toWeek: 1, toDayIndex: 0 }],
  });

  assert.ok(result.change);
  const schedule = result.campaignObject.meta.mediaPlanSchedule;
  assert.equal(schedule?.marketIntelligence?.enabled, true);
  assert.equal(schedule?.marketIntelligence?.toggles?.salaryCycle, false);
  assert.equal(schedule?.marketIntelligence?.toggles?.ramadan, true);
  assert.ok(schedule?.priorityWeights?.objectives?.awareness);
  assert.equal(schedule?.weekWeights?.join(","), "40,30,20,10");
});

test("applyMediaPlanScheduleChange merges marketIntelligence overrides", () => {
  const object = buildCampaignObjectFixture();
  object.meta.mediaPlanSchedule = {
    marketIntelligence: {
      enabled: true,
      toggles: { salaryCycle: true, weather: true },
    },
  };

  const result = applyMediaPlanScheduleChange(object, {
    marketIntelligence: {
      toggles: { salaryCycle: false, retailSeasons: false },
    },
  });

  assert.ok(result.change?.includes("market intelligence"));
  const mi = result.campaignObject.meta.mediaPlanSchedule?.marketIntelligence;
  assert.equal(mi?.enabled, true);
  assert.equal(mi?.toggles?.salaryCycle, false);
  assert.equal(mi?.toggles?.retailSeasons, false);
  assert.equal(mi?.toggles?.weather, true);
});

test("mergeMediaPlanMarketIntelligenceMeta applies partial toggle patches", () => {
  const merged = mergeMediaPlanMarketIntelligenceMeta(
    { enabled: true, toggles: { salaryCycle: true, ramadan: false } },
    { toggles: { salaryCycle: false } }
  );

  assert.equal(merged.enabled, true);
  assert.equal(merged.toggles?.salaryCycle, false);
  assert.equal(merged.toggles?.ramadan, false);
});

test("resolveMarketIntelligenceConfig merges stored toggles with defaults", () => {
  const object = buildCampaignObjectFixture();
  object.meta.mediaPlanSchedule = {
    marketIntelligence: {
      enabled: false,
      toggles: { weather: false },
    },
  };

  const config = resolveMarketIntelligenceConfig(object);
  assert.equal(config.enabled, false);
  assert.equal(config.toggles.weather, false);
  assert.equal(config.toggles.salaryCycle, true);
});
