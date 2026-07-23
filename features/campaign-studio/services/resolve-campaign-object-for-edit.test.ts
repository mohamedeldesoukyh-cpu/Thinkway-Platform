import assert from "node:assert/strict";
import test from "node:test";

import { buildCampaignObjectFixture } from "@/features/campaign-outputs/output-test-fixture";
import { generateCampaignOutput } from "@/features/campaign-outputs/output-registry";
import { mergeBriefIntoCampaignObject } from "@/features/campaign-studio/services/merge-campaign-brief";
import {
  mergeCampaignOutputRegistries,
  resolveCampaignObjectForBriefEdit,
} from "@/features/campaign-studio/services/resolve-campaign-object-for-edit";

test("mergeCampaignOutputRegistries keeps the highest-version generated record", () => {
  const obj = buildCampaignObjectFixture();
  const withMedia = generateCampaignOutput(obj, "media_plan").campaignObject;
  const withStrategy = generateCampaignOutput(withMedia, "full_strategy").campaignObject;

  const persistenceOnly = {
    ...withStrategy,
    meta: { ...withStrategy.meta, campaignOutputs: {} },
  };

  const merged = resolveCampaignObjectForBriefEdit({
    fromPersistence: persistenceOnly,
    fromLatestStudioMessage: withStrategy,
  });

  assert.ok(merged);
  assert.equal(merged!.meta.campaignOutputs?.media_plan?.version, 1);
  assert.equal(merged!.meta.campaignOutputs?.full_strategy?.version, 1);
});

test("resolveCampaignObjectForBriefEdit marks outputs stale after brief merge", () => {
  const obj = buildCampaignObjectFixture({
    creators: [{ id: "cr_1", name: "Creator One", tier: "Macro" }],
  });
  const withStrategy = generateCampaignOutput(obj, "full_strategy").campaignObject;
  const withMedia = generateCampaignOutput(withStrategy, "media_plan").campaignObject;

  const persistenceOnly = {
    ...withMedia,
    meta: { ...withMedia.meta, campaignOutputs: {} },
  };

  const canonical = resolveCampaignObjectForBriefEdit({
    fromPersistence: persistenceOnly,
    fromLatestStudioMessage: withMedia,
  });
  assert.ok(canonical);

  const brief =
    "Acme summer launch in Egypt targeting moms 25-40. Front-load Week 1 with hero creators, sustain weeks 2-4.";
  const { campaignObject } = mergeBriefIntoCampaignObject(canonical!, brief);

  assert.equal(campaignObject.meta.campaignOutputs?.full_strategy?.status, "needs_update");
  assert.equal(campaignObject.meta.campaignOutputs?.media_plan?.status, "needs_update");
});

test("mergeCampaignOutputRegistries unions distinct kinds", () => {
  const obj = buildCampaignObjectFixture();
  const withMedia = generateCampaignOutput(obj, "media_plan").campaignObject;
  const withStrategy = generateCampaignOutput(obj, "full_strategy").campaignObject;

  const merged = mergeCampaignOutputRegistries(
    withMedia.meta.campaignOutputs,
    withStrategy.meta.campaignOutputs
  );

  assert.ok(merged.media_plan);
  assert.ok(merged.full_strategy);
});
