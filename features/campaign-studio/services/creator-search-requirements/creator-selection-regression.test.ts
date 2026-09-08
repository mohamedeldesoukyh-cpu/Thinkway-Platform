/**
 * Phase 1 regression guard.
 *
 * Creator Search Requirements are foundation + shadow only. These tests exist to
 * fail loudly if CSR ever starts influencing creator selection before the phase
 * that is supposed to introduce that change.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";

import { proposeInitialCreatorSlateWithStatus } from "../propose-creator-slate";
import {
  attachCreatorSearchRequirements,
  isCreatorSearchRequirementsCurrent,
} from "./attach-creator-search-requirements";

const NOW = "2026-01-01T00:00:00.000Z";

const strategy: CampaignStrategyDocument = {
  id: "strategy-1",
  version: 2,
  createdAt: NOW,
  understanding: {
    brand: "BabyJoy",
    objective: "Awareness among Egyptian mothers",
    geography: "Egypt",
    audience: "Egyptian mothers",
    platforms: ["Instagram"],
    kpis: [],
    risks: [],
    constraints: [],
  },
  narrative: "Parenting-led.",
  pillars: [{ title: "Parenting", what: "Routines", why: "Trust" }],
  platformMix: [],
  creatorTierStrategy: [{ tier: "Macro", allocationPercent: 100, why: "Reach" }],
};

function poolCreatorsData(): CreatorsSectionData {
  return {
    phase: "discovery",
    discovery: { creatorIds: ["cr-1", "cr-2", "cr-3", "cr-4", "cr-5"], total: 5 },
    recommendations: {
      creatorIds: [],
      selectedReasoning: [
        { creatorId: "cr-1", displayName: "Mom One", handle: "@momone", platform: "instagram", confidence: 0.92 },
        { creatorId: "cr-2", displayName: "Mom Two", handle: "@momtwo", platform: "instagram", confidence: 0.81 },
        { creatorId: "cr-3", displayName: "Mom Three", handle: "@momthree", platform: "instagram", confidence: 0.74 },
        { creatorId: "cr-4", displayName: "Dad Four", handle: "@dadfour", platform: "tiktok", confidence: 0.66 },
        { creatorId: "cr-5", displayName: "Mom Five", handle: "@momfive", platform: "instagram", confidence: 0.58 },
      ],
    },
  } as unknown as CreatorsSectionData;
}

function campaignObject(
  creatorsData: CreatorsSectionData,
  meta: Record<string, unknown> = {}
): CampaignObject {
  return {
    id: "co-1",
    conversationId: "conv-1",
    workflowId: "create-campaign",
    updatedAt: NOW,
    sections: {
      creators: { status: "complete", content: "", data: creatorsData },
      strategy: { status: "complete", content: "Parenting campaign" },
      summary: { status: "complete", content: "BabyJoy" },
      timeline: { status: "complete", content: "", data: {} },
    },
    meta: {
      status: "complete",
      specialistProgress: [],
      campaignFacts: {
        brandName: "BabyJoy",
        industry: "Baby & Parenting",
        objective: "Awareness among mothers",
        budget: { amount: 2_000_000, currency: "EGP" },
        durationWeeks: 6,
        platforms: ["Instagram"],
        geography: ["Egypt"],
        audience: "Mothers",
        deliverables: [],
        kpis: [],
        extractedAt: NOW,
        confidence: {},
        sources: {},
      },
      ...meta,
    },
  } as unknown as CampaignObject;
}

// 10 — Existing creator-selection output remains unchanged --------------------

test("REGRESSION: slate membership is unchanged by CSR (pinned to pre-CSR output)", () => {
  const result = proposeInitialCreatorSlateWithStatus(campaignObject(poolCreatorsData()));
  const data = result.campaignObject.sections.creators.data as CreatorsSectionData;

  // Verified identical against main @ e34cbd9 with CSR absent.
  assert.equal(result.proposed, true);
  assert.deepEqual(data.recommendations?.creatorIds, ["cr-1", "cr-2", "cr-3"]);
  assert.equal(data.slateProposalStatus?.status, "proposed");
});

test("REGRESSION: selection is identical with and without a Strategy document", () => {
  const withoutStrategy = proposeInitialCreatorSlateWithStatus(campaignObject(poolCreatorsData()));
  const withStrategy = proposeInitialCreatorSlateWithStatus(
    campaignObject(poolCreatorsData(), { campaignStrategyDocument: strategy })
  );

  const a = withoutStrategy.campaignObject.sections.creators.data as CreatorsSectionData;
  const b = withStrategy.campaignObject.sections.creators.data as CreatorsSectionData;

  assert.deepEqual(a.recommendations?.creatorIds, b.recommendations?.creatorIds);
  assert.deepEqual(a.recommendations?.creatorFitScores, b.recommendations?.creatorFitScores);
  assert.equal(a.recommendationsDisplay, b.recommendationsDisplay);

  // ...but the Strategy run carries richer requirements.
  assert.equal(a.searchRequirements?.strategyRef, undefined);
  assert.equal(b.searchRequirements?.strategyRef?.id, "strategy-1");
  assert.equal(b.searchRequirements?.strategic.tierMix.length, 1);
});

test("REGRESSION: attaching CSR is purely additive to the campaign object", () => {
  const original = campaignObject(poolCreatorsData(), {
    campaignStrategyDocument: strategy,
  });
  const snapshot = structuredClone(original);

  const attached = attachCreatorSearchRequirements(original, { now: NOW });

  // The input object is never mutated.
  assert.deepStrictEqual(original, snapshot);

  const attachedData = { ...(attached.sections.creators.data as CreatorsSectionData) };
  assert.ok(attachedData.searchRequirements, "CSR should be attached");
  delete attachedData.searchRequirements;

  // Removing CSR yields byte-identical creators data.
  assert.deepStrictEqual(attachedData, snapshot.sections.creators.data);

  // And nothing outside sections.creators.data changed.
  const rebuilt = {
    ...attached,
    sections: {
      ...attached.sections,
      creators: { ...attached.sections.creators, data: attachedData },
    },
  };
  assert.deepStrictEqual(rebuilt, snapshot);
});

// 9 — Existing campaigns without CSR still work ------------------------------

test("a campaign object with no CSR and no strategy still proposes as before", () => {
  const result = proposeInitialCreatorSlateWithStatus(campaignObject(poolCreatorsData()));
  const data = result.campaignObject.sections.creators.data as CreatorsSectionData;

  assert.deepEqual(data.recommendations?.creatorIds, ["cr-1", "cr-2", "cr-3"]);
  assert.ok(data.searchRequirements, "CSR is generated even without a strategy");
  assert.ok(
    data.searchRequirements.gaps.some((g) => g.field === "strategyRef" && g.blocking),
    "the missing strategy is recorded as a blocking gap rather than invented"
  );
});

test("an empty campaign object is blocked exactly as before", () => {
  const result = proposeInitialCreatorSlateWithStatus(campaignObject({}));
  const data = result.campaignObject.sections.creators.data as CreatorsSectionData;

  assert.equal(result.proposed, false);
  assert.equal(data.slateProposalStatus?.status, "blocked");
  assert.equal(data.slateProposalStatus?.reason, "no_discovery_results");
  assert.ok(data.searchRequirements, "CSR is still recorded on a blocked proposal");
});

test("a pre-CSR campaign object deserializes and proposes without error", () => {
  // Simulates a campaign persisted before the field existed.
  const legacy = campaignObject(poolCreatorsData());
  assert.equal(
    (legacy.sections.creators.data as CreatorsSectionData).searchRequirements,
    undefined
  );

  const result = proposeInitialCreatorSlateWithStatus(legacy);
  assert.equal(result.proposed, true);
});

// 10 — Strategy version awareness (no re-ranking yet) ------------------------

test("CSR is regenerated only when the strategy revision changes", () => {
  const base = campaignObject(poolCreatorsData(), { campaignStrategyDocument: strategy });
  const first = attachCreatorSearchRequirements(base, { now: NOW });

  // Same strategy revision → same object reference, no churn.
  const second = attachCreatorSearchRequirements(first, { now: "2026-02-02T00:00:00.000Z" });
  assert.equal(second, first);

  // Bumped strategy revision → regenerated.
  const bumped = {
    ...first,
    meta: {
      ...first.meta,
      campaignStrategyDocument: { ...strategy, version: 3 },
    },
  } as unknown as CampaignObject;
  const third = attachCreatorSearchRequirements(bumped, { now: "2026-03-03T00:00:00.000Z" });
  const thirdData = third.sections.creators.data as CreatorsSectionData;

  assert.notEqual(third, bumped);
  assert.equal(thirdData.searchRequirements?.strategyRef?.version, 3);
  assert.equal(thirdData.searchRequirements?.generatedAt, "2026-03-03T00:00:00.000Z");

  // Version awareness must NOT trigger re-ranking in Phase 1.
  assert.deepEqual(
    thirdData.recommendations?.creatorIds,
    (bumped.sections.creators.data as CreatorsSectionData).recommendations?.creatorIds
  );
});

test("isCreatorSearchRequirementsCurrent handles the no-strategy case", () => {
  assert.equal(isCreatorSearchRequirementsCurrent(undefined, undefined, undefined), false);
  assert.equal(
    isCreatorSearchRequirementsCurrent(
      { strategyRef: undefined } as never,
      undefined,
      undefined
    ),
    true
  );
  assert.equal(
    isCreatorSearchRequirementsCurrent(
      { strategyRef: { id: "s1", version: 1, createdAt: NOW } } as never,
      "s1",
      2
    ),
    false
  );
});
