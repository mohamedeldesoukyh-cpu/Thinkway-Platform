import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveWeekWeightsFromBrief,
  hasCampaignBriefText,
  resolveBriefTextForScheduling,
} from "./brief-media-plan-schedule";
import { buildCampaignObjectFixture } from "./output-test-fixture";
import { countDeliverablesPerWeek } from "./media-plan-scheduler";
import { mergeBriefIntoCampaignObject } from "@/features/campaign-studio/services/merge-campaign-brief";
import {
  generateCampaignOutput,
  getCampaignOutput,
  listCampaignOutputs,
  staleCampaignOutputKinds,
} from "./output-registry";
import { resolveSlate } from "./output-inputs";

test("deriveWeekWeightsFromBrief returns undefined without a brief", () => {
  assert.equal(deriveWeekWeightsFromBrief("short", 4), undefined);
});

test("launch brief front-loads creators — not equal split", () => {
  const brief =
    "BabyJoy summer launch in Egypt — heavy Week 1 go-live with macro anchors, then sustain through weeks 2-4.";
  const weights = deriveWeekWeightsFromBrief(brief, 4);
  assert.ok(weights);
  assert.ok((weights![0] ?? 0) > (weights![3] ?? 0));
});

test("steady sustain brief can use even weights when explicitly requested", () => {
  const brief =
    "Steady always-on publishing — spread creators evenly throughout the 4-week campaign with consistent cadence.";
  const weights = deriveWeekWeightsFromBrief(brief, 4);
  assert.ok(weights);
  const spread = Math.max(...weights!) - Math.min(...weights!);
  assert.ok(spread <= 8, `expected near-even weights, got ${weights!.join(",")}`);
});

test("parseWeekWeightIntent style front vs last weeks", () => {
  const brief =
    "Concentrate publishing in the first 2 weeks vs last 2 weeks of this 4-week skincare launch.";
  const weights = deriveWeekWeightsFromBrief(brief, 4);
  assert.ok(weights);
  assert.ok((weights![0] ?? 0) + (weights![1] ?? 0) > (weights![2] ?? 0) + (weights![3] ?? 0));
});

test("with brief weights, more deliverables land in early weeks", () => {
  const brief = "Launch week burst — front-load creator publishing in week 1 for maximum awareness.";
  const weights = deriveWeekWeightsFromBrief(brief, 4)!;
  const slate = Array.from({ length: 8 }, (_, index) => ({
    creatorId: `c${index}`,
    displayName: `Creator ${index}`,
    tier: "Macro",
    serviceTypes: ["1× IG Reel"],
  }));
  const weekCounts = countDeliverablesPerWeek(slate, 4, { weekWeights: weights });
  const early = (weekCounts[0] ?? 0) + (weekCounts[1] ?? 0);
  const late = (weekCounts[2] ?? 0) + (weekCounts[3] ?? 0);
  assert.ok(early > late, "launch-heavy weights should concentrate influence in early weeks");
  assert.ok((weekCounts[0] ?? 0) < slate.length, "week 1 should not schedule every creator");
});

test("mergeBriefIntoCampaignObject marks brief-dependent outputs as needs_update", () => {
  const obj = buildCampaignObjectFixture({
    facts: { durationWeeks: 4, brandName: "Acme" },
    creators: [
      { id: "cr_1", name: "Creator One", tier: "Macro" },
      { id: "cr_2", name: "Creator Two", tier: "Mid" },
    ],
  });
  const withStrategy = generateCampaignOutput(obj, "full_strategy").campaignObject;
  const withMedia = generateCampaignOutput(withStrategy, "media_plan").campaignObject;

  const brief =
    "Acme summer launch in Egypt targeting moms 25-40. Front-load Week 1 with hero creators, sustain weeks 2-4. Objective: awareness and trial.";
  const { campaignObject } = mergeBriefIntoCampaignObject(withMedia, brief);

  assert.equal(getCampaignOutput(campaignObject, "full_strategy")?.status, "needs_update");
  assert.equal(getCampaignOutput(campaignObject, "media_plan")?.status, "needs_update");
  assert.ok(staleCampaignOutputKinds(campaignObject).includes("full_strategy"));
  assert.ok(staleCampaignOutputKinds(campaignObject).includes("media_plan"));

  const strategyView = listCampaignOutputs(campaignObject).find((v) => v.kind === "full_strategy");
  const mediaView = listCampaignOutputs(campaignObject).find((v) => v.kind === "media_plan");
  assert.equal(strategyView?.status, "needs_update");
  assert.equal(mediaView?.status, "needs_update");
  assert.match(strategyView?.staleReason ?? "", /Campaign brief changed/);
  assert.match(mediaView?.staleReason ?? "", /Campaign brief changed/);
});

test("mergeBriefIntoCampaignObject preserves quotation slate", () => {
  const obj = buildCampaignObjectFixture({
    facts: { durationWeeks: 4, brandName: "Acme" },
    creators: [
      { id: "cr_1", name: "Creator One", tier: "Macro" },
      { id: "cr_2", name: "Creator Two", tier: "Mid" },
    ],
  });
  for (const entry of (obj.sections.creators.data as { recommendations?: { selectedReasoning?: Array<{ quotedRevenue?: number; serviceTypes?: string[] }> } }).recommendations!.selectedReasoning!) {
    entry.quotedRevenue = 5000;
    entry.serviceTypes = ["1× IG Reel"];
  }

  const brief =
    "Acme summer launch in Egypt targeting moms 25-40. Front-load Week 1 with hero creators, sustain weeks 2-4. Objective: awareness and trial.";
  const { campaignObject, change } = mergeBriefIntoCampaignObject(obj, brief);

  assert.ok(change);
  assert.equal(resolveSlate(campaignObject).length, 2);
  assert.ok(hasCampaignBriefText(campaignObject));
  assert.ok(resolveBriefTextForScheduling(campaignObject).includes("Acme summer launch"));
  assert.ok(campaignObject.meta.mediaPlanSchedule?.weekWeights?.length);
});
