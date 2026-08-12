import { strict as assert } from "node:assert";
import { test } from "node:test";

import { buildCampaignObjectFixture } from "@/features/campaign-outputs/output-test-fixture";
import { applyMediaPlanScheduleChange } from "@/features/campaign-outputs/media-plan-mutations";
import { mergeMediaPlanMarketIntelligenceMeta } from "@/features/campaign-outputs/media-plan-schedule";
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

test("applyMediaPlanScheduleChange accepts calendar weeks beyond facts durationWeeks", () => {
  const object = buildCampaignObjectFixture({
    facts: { durationWeeks: 4 },
  });
  object.meta.campaignOutputs = {
    media_plan: {
      content: {
        data: {
          durationWeeks: 4,
          calendarWeeks: 6,
          weeks: [{ week: 1 }, { week: 2 }, { week: 3 }, { week: 4 }, { week: 5 }, { week: 6 }],
        },
      },
    },
  } as typeof object.meta.campaignOutputs;

  const result = applyMediaPlanScheduleChange(object, {
    moveCreators: [{ creatorIds: ["cr_star"], toWeek: 6, toDayIndex: 1 }],
  });

  assert.ok(result.change, "move onto calendar week 6 should apply");
  const pin = result.campaignObject.meta.mediaPlanSchedule?.assignments?.find(
    (assignment) => assignment.creatorId === "cr_star"
  );
  assert.equal(pin?.week, 6);
  assert.equal(pin?.dayIndex, 1);
});

test("applyMediaPlanScheduleChange resolves Remaining influencer ids via creator name", () => {
  const object = buildCampaignObjectFixture();
  const result = applyMediaPlanScheduleChange(object, {
    moveCreators: [
      {
        creatorIds: ["inf-uuid-not-on-slate"],
        names: ["Nour Star"],
        toWeek: 2,
        toDayIndex: 3,
        deliverableTypes: ["1× IG Reel"],
      },
    ],
  });

  assert.ok(result.change, "name fallback should pin the slate creator");
  const pin = result.campaignObject.meta.mediaPlanSchedule?.assignments?.find(
    (assignment) => assignment.creatorId === "cr_star"
  );
  assert.ok(pin);
  assert.equal(pin?.week, 2);
  assert.equal(pin?.dayIndex, 3);
  assert.equal(pin?.serviceType, "1× IG Reel");
});

test("applyMediaPlanScheduleChange synthesizes a pin when creator is absent from slate", () => {
  const object = buildCampaignObjectFixture({ creators: [] });
  const result = applyMediaPlanScheduleChange(object, {
    moveCreators: [
      {
        creatorIds: ["inf-orphan"],
        names: ["Orphan Creator"],
        toWeek: 1,
        toDayIndex: 0,
      },
    ],
  });

  assert.ok(result.change);
  const pin = result.campaignObject.meta.mediaPlanSchedule?.assignments?.find(
    (assignment) => assignment.creatorId === "inf-orphan"
  );
  assert.ok(pin);
  assert.equal(pin?.week, 1);
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
