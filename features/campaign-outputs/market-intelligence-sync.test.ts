import { strict as assert } from "node:assert";
import { test } from "node:test";

import { buildCampaignObjectFixture } from "./output-test-fixture";
import {
  generateCampaignOutput,
  getCampaignOutput,
  listCampaignOutputs,
  markStaleCampaignOutputs,
} from "./output-registry";
import { applyMediaPlanScheduleChange } from "./media-plan-schedule";
import { marketIntelligenceDisplayKey } from "@/features/market-intelligence/market-intelligence-config";
import { computeInputFingerprint } from "./output-fingerprint";

test("market intelligence fingerprint changes when master toggle flips", () => {
  const object = buildCampaignObjectFixture();
  const enabledKey = marketIntelligenceDisplayKey(object);

  object.meta.mediaPlanSchedule = { marketIntelligence: { enabled: false } };
  const disabledKey = marketIntelligenceDisplayKey(object);

  assert.notEqual(enabledKey, disabledKey);
});

test("disabling market intelligence marks all dependent generated outputs stale", () => {
  let object = buildCampaignObjectFixture();
  object = generateCampaignOutput(object, "media_plan").campaignObject;
  object = generateCampaignOutput(object, "full_strategy").campaignObject;
  object = generateCampaignOutput(object, "kpi_forecast").campaignObject;

  const toggled = applyMediaPlanScheduleChange(object, {
    marketIntelligence: { enabled: false },
  }).campaignObject;

  const stale = markStaleCampaignOutputs(toggled);

  for (const kind of ["media_plan", "full_strategy", "kpi_forecast"] as const) {
    assert.equal(getCampaignOutput(stale, kind)?.status, "needs_update", `${kind} should be stale`);
  }

  const strategyView = listCampaignOutputs(stale).find((v) => v.kind === "full_strategy");
  assert.match(strategyView?.staleReason ?? "", /Market intelligence settings changed/);
});

test("factor toggle change marks media plan stale but not budget-only outputs", () => {
  let object = buildCampaignObjectFixture();
  object = generateCampaignOutput(object, "media_plan").campaignObject;
  object = generateCampaignOutput(object, "budget_allocation").campaignObject;

  object.meta.mediaPlanSchedule = {
    ...object.meta.mediaPlanSchedule,
    marketIntelligence: { enabled: true, toggles: { salaryCycle: true } },
  };

  const before = computeInputFingerprint(object, "market_intelligence");

  const toggled = applyMediaPlanScheduleChange(object, {
    marketIntelligence: { toggles: { salaryCycle: false } },
  }).campaignObject;

  const after = computeInputFingerprint(toggled, "market_intelligence");
  assert.notEqual(before, after);

  const stale = markStaleCampaignOutputs(toggled);
  assert.equal(getCampaignOutput(stale, "media_plan")?.status, "needs_update");
  assert.equal(getCampaignOutput(stale, "budget_allocation")?.status, "generated");
});

test("marketIntelligenceDisplayKey stays in sync between outputs center and edit schedule meta", () => {
  const object = buildCampaignObjectFixture();
  object.meta.mediaPlanSchedule = {
    marketIntelligence: {
      enabled: true,
      toggles: { ramadan: false, weather: true },
    },
  };

  const keyFromMeta = marketIntelligenceDisplayKey(object);
  assert.match(keyFromMeta, /true/);
  assert.match(keyFromMeta, /ramadan/);
});
