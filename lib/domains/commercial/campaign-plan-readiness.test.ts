import assert from "node:assert/strict";

import type { CampaignObject } from "@/features/campaign-intelligence";

import { evaluateCampaignPlanReadiness } from "./campaign-plan-readiness";

function baseObject(overrides?: Partial<CampaignObject>): CampaignObject {
  return {
    id: "co-readiness",
    workflowId: null,
    sections: {
      summary: { content: "", status: "pending" },
      audience: { content: "", status: "pending" },
      strategy: { content: "Full strategy narrative with enough detail for review.", status: "complete" },
      creators: {
        content: "",
        data: { recommendations: { creatorIds: ["inf:a"] } },
        status: "complete",
      },
      budget: { content: "", status: "pending" },
      timeline: {
        content: { durationWeeks: 6, milestones: [{ week: 1, phase: "Launch", activities: ["Kickoff"] }] },
        status: "complete",
      },
      performance: { content: "", status: "pending" },
      presentation: { content: "", status: "pending" },
      operations: { content: "", status: "pending" },
    },
    meta: {
      status: "complete",
      specialistProgress: [],
      campaignFacts: {
        clientName: "Acme Co",
        brandName: "Acme Brand",
        objective: "Drive awareness",
        geography: ["Egypt"],
        platforms: ["Instagram"],
        budget: { amount: 500_000, currency: "EGP" },
        durationWeeks: 6,
        extractedAt: new Date().toISOString(),
        confidence: {},
        sources: {},
      },
      campaignOutputs: {
        full_strategy: {
          kind: "full_strategy",
          status: "generated",
          version: 1,
          generatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          sourceFingerprint: "fp",
          generatorVersion: "1",
          origin: "user",
          content: {},
        },
        media_plan: {
          kind: "media_plan",
          status: "generated",
          version: 1,
          generatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          sourceFingerprint: "fp",
          generatorVersion: "1",
          origin: "user",
          content: {},
        },
      },
    },
    ...overrides,
  } as CampaignObject;
}

const ready = evaluateCampaignPlanReadiness(baseObject());
assert.equal(ready.status, "ready_for_review");
assert.equal(ready.mandatoryMissing.length, 0);
assert.equal(ready.statusLabel, "Ready for Review");

const missingTimeline = evaluateCampaignPlanReadiness(
  baseObject({
    sections: {
      ...baseObject().sections,
      timeline: { content: "", status: "pending" },
    },
    meta: {
      ...baseObject().meta,
      campaignFacts: {
        ...baseObject().meta.campaignFacts!,
        durationWeeks: undefined,
      },
    },
  })
);
assert.equal(missingTimeline.status, "not_ready");
assert.ok(missingTimeline.mandatoryMissing.some((item) => item.id === "timeline"));

const missingMediaPlan = evaluateCampaignPlanReadiness(
  baseObject({
    meta: {
      ...baseObject().meta,
      campaignOutputs: {
        full_strategy: baseObject().meta.campaignOutputs!.full_strategy,
      },
    },
  })
);
assert.equal(missingMediaPlan.status, "not_ready");
assert.ok(missingMediaPlan.mandatoryMissing.some((item) => item.id === "media_plan"));

const brandAsClient = evaluateCampaignPlanReadiness(
  baseObject({
    meta: {
      ...baseObject().meta,
      campaignFacts: {
        ...baseObject().meta.campaignFacts!,
        clientName: undefined,
        brandName: "Noon",
      },
    },
  })
);
assert.equal(
  brandAsClient.status,
  "ready_for_review",
  "STAB-030: brand-as-client must satisfy Client readiness"
);
assert.equal(brandAsClient.mandatoryMissing.length, 0);

assert.ok(ready.optionalRemaining >= 1, "optional items may remain while still ready");

console.log("campaign-plan-readiness.test.ts — all tests passed");
