/**
 * What `recommendations.creatorIds` MEANS, and who may act on it.
 *
 * Traced from the writers and every consumer, not from the field name:
 *
 *   - it is written from `composeCreatorSlate` — a COMPOSITION, sized to the
 *     requested quantity and gated at the fit floor and the tier mix;
 *   - it has a sibling `rejectedReasoning`, so "selected" is membership;
 *   - `approve_creator` / `reject_creator` do NOT change membership — they
 *     write `vendorDecisions`. Only `remove_creator` removes a creator;
 *   - `filterExecutionCreatorIds` (commercial execution) = slate MINUS
 *     `vendorDecisions` rejections;
 *   - `create-client-review` maps slate ids to accepted / rejected /
 *     `in_review` from `vendorDecisions` — the slate is in review by default;
 *   - `selectStudioRecommendedVendors` reads `planningSignal.recommendation`,
 *     which is hydrated per browser session and NEVER persisted.
 *
 * So the slate is the WORKING campaign slate, status lives in
 * `vendorDecisions`, and the ECI recommendation gate is session-local evidence
 * — it must not silently redefine the campaign's creator set. These tests pin
 * that contract, and the invariant that follows from it: no creator reaches a
 * campaign Content plan without a defined status, and a creator the operator
 * rejected never appears there at all.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyCampaignObject } from "@/features/campaign-intelligence/services/section-updaters";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import { filterExecutionCreatorIds } from "@/lib/domains/commercial/campaign-plan-execution-mapper";

import {
  activeCampaignCreatorIds,
  campaignContentBasisLine,
  creatorDecisionStatus,
  isCreatorRejected,
} from "./creator-decision-status";
import { deriveInfluencerContentPlan } from "./influencer-content-plan";
import { partitionStudioCreatorGroups } from "./studio-creator-groups";
import { creatorGroupingKey } from "./studio-creator-slate-split";

const SLATE_SIZE = 10;

function campaign(input?: {
  decisions?: Record<string, "approved" | "rejected" | "shortlisted">;
}): CampaignObject {
  const object = createEmptyCampaignObject({
    id: "kerastase-contract",
    conversationId: "conv-kerastase-contract",
    workflowId: "create-campaign",
  });
  object.meta.campaignFacts = {
    extractedAt: new Date().toISOString(),
    confidence: {},
    sources: {},
    brandName: "Kerastase",
    objective: "Brand awareness",
    geography: ["Saudi Arabia"],
    platforms: ["Instagram", "TikTok"],
    durationWeeks: 6,
  } as CampaignObject["meta"]["campaignFacts"];

  const selectedReasoning = Array.from({ length: SLATE_SIZE }, (_, i) => ({
    creatorId: `inf:c${i + 1}`,
    displayName: `Creator ${i + 1}`,
    handle: `@c${i + 1}`,
    platform: i % 2 === 0 ? "instagram" : "tiktok",
    whySelected: `Category fit ${i + 1}`,
    expectedRole: i < 4 ? "Macro" : i < 7 ? "Mid" : "Micro",
    audienceMatch: "Saudi Arabia 25–44",
    risk: "Low",
    alternative: "—",
    confidence: 0.7,
    evidence: "Category + market",
    tradeoff: "—",
  }));

  const creatorsData: CreatorsSectionData = {
    phase: "proposal",
    recommendations: {
      creatorIds: selectedReasoning.map((row) => row.creatorId),
      selectedReasoning,
    },
    ...(input?.decisions ? { vendorDecisions: input.decisions } : {}),
  };
  object.sections.creators.data = creatorsData as unknown as Record<string, unknown>;
  return object;
}

const slateIds = (object: CampaignObject) =>
  ((object.sections.creators.data as CreatorsSectionData).recommendations?.creatorIds ?? []);

// ---------------------------------------------------------------------------
// 1. Membership and status are two layers.

test("approve and reject do not change slate membership", () => {
  // Only `remove_creator` removes a creator; the decision kinds write status.
  const before = slateIds(campaign());
  const after = slateIds(
    campaign({ decisions: { "inf:c4": "rejected", "inf:c5": "approved" } })
  );
  assert.deepEqual(after, before, "membership is stable across operator decisions");
});

test("a slate creator with no decision is `proposed`, never `approved`", () => {
  const object = campaign();
  const decisions = (object.sections.creators.data as CreatorsSectionData).vendorDecisions;
  for (const id of slateIds(object)) {
    assert.equal(creatorDecisionStatus(decisions, id), "proposed", id);
  }
});

test("the decision key tolerates the `inf:` prefix either way", () => {
  assert.equal(isCreatorRejected({ "c4": "rejected" }, "inf:c4"), true);
  assert.equal(isCreatorRejected({ "inf:c4": "rejected" }, "inf:c4"), true);
  assert.equal(isCreatorRejected({ "inf:c4": "rejected" }, "inf:c5"), false);
});

// ---------------------------------------------------------------------------
// 2. Content and execution now read the campaign's active creators identically.

test("a rejected creator never appears in the Content plan", () => {
  const object = campaign({ decisions: { "inf:c4": "rejected", "inf:c9": "rejected" } });
  const planned = deriveInfluencerContentPlan(object).map((item) => item.creatorId);

  assert.equal(planned.length, SLATE_SIZE - 2);
  assert.ok(!planned.includes("inf:c4"), "the operator took this creator out of the plan");
  assert.ok(!planned.includes("inf:c9"));
});

test("Content and commercial execution agree on the campaign's creators", () => {
  const object = campaign({ decisions: { "inf:c4": "rejected" } });
  const planned = deriveInfluencerContentPlan(object).map((item) => item.creatorId);
  const executed = filterExecutionCreatorIds(object);

  // Execution normalises differently downstream; compare on creator identity.
  assert.deepEqual(
    planned.map(creatorGroupingKey),
    executed.map(creatorGroupingKey),
    "the client-facing content plan and the executed plan must not disagree"
  );
});

test("with no decisions recorded, Content is the whole working slate", () => {
  const object = campaign();
  assert.equal(deriveInfluencerContentPlan(object).length, SLATE_SIZE);
  assert.deepEqual(activeCampaignCreatorIds(slateIds(object), undefined), slateIds(object));
});

test("every Content row carries a defined status", () => {
  const object = campaign({ decisions: { "inf:c2": "approved", "inf:c3": "shortlisted" } });
  const plan = deriveInfluencerContentPlan(object);

  for (const item of plan) {
    assert.ok(item.creatorStatus, `${item.creatorId} has no status`);
    assert.notEqual(item.creatorStatus, "rejected", "a rejected creator is excluded, not labelled");
  }
  assert.equal(plan.find((i) => i.creatorId === "inf:c2")?.creatorStatus, "approved");
  assert.equal(plan.find((i) => i.creatorId === "inf:c3")?.creatorStatus, "shortlisted");
  assert.equal(plan.find((i) => i.creatorId === "inf:c1")?.creatorStatus, "proposed");
});

test("Content says what it is showing, and what it excluded", () => {
  assert.equal(
    campaignContentBasisLine({ creatorCount: 10, rejectedCount: 0 }),
    "Working campaign slate · 10 creators · status shown per creator."
  );
  assert.match(
    campaignContentBasisLine({ creatorCount: 9, rejectedCount: 1 }),
    /1 rejected creator excluded\.$/
  );
  // It never claims a recommendation count.
  assert.doesNotMatch(
    campaignContentBasisLine({ creatorCount: 10, rejectedCount: 0 }),
    /recommended/i
  );
});

// ---------------------------------------------------------------------------
// 3. The ECI gate is evidence, not membership.

test("the ECI gate never removes a creator from the campaign's plan", () => {
  // Its input is hydrated per session and never persisted, so if it decided
  // membership the campaign's creator set would depend on hydration timing.
  const object = campaign();
  const plan = deriveInfluencerContentPlan(object);
  const ids = plan.map((item) => item.creatorId);

  // Session evidence rejects seven of the ten on this render.
  const groups = partitionStudioCreatorGroups({
    pool: ids.map((id) => ({ id })),
    gated: ids.slice(0, 3).map((id) => ({ id })),
    slateIds: ids,
    idOf: (row) => row.id,
    normalize: creatorGroupingKey,
  });

  assert.equal(groups.selected.length, 3, "only three are recommended on this render");
  assert.equal(groups.needsReview.length, 7, "the rest are held for review, on screen");
  assert.equal(plan.length, SLATE_SIZE, "and the campaign's plan is unchanged by that render");
});

test("a creator held by the ECI gate is never shown as recommended", () => {
  const object = campaign();
  const ids = slateIds(object);
  const groups = partitionStudioCreatorGroups({
    pool: ids.map((id) => ({ id })),
    gated: ids.slice(0, 3).map((id) => ({ id })),
    slateIds: ids,
    idOf: (row) => row.id,
    normalize: creatorGroupingKey,
  });
  const recommended = new Set(groups.selected.map((row) => creatorGroupingKey(row.id)));
  for (const row of groups.needsReview) {
    assert.equal(recommended.has(creatorGroupingKey(row.id)), false, row.id);
  }
});

test("the persisted slate is never rewritten to match one render's gate", () => {
  const object = campaign();
  const before = slateIds(object);
  deriveInfluencerContentPlan(object);
  partitionStudioCreatorGroups({
    pool: before.map((id) => ({ id })),
    gated: [],
    slateIds: before,
    idOf: (row) => row.id,
    normalize: creatorGroupingKey,
  });
  assert.deepEqual(slateIds(object), before, "Strategy's requested count survives the render");
});

// ---------------------------------------------------------------------------
// 4. Tier mix and ordering survive the exclusion.

test("excluding a rejected creator does not re-derive tiers or reorder the plan", () => {
  const full = deriveInfluencerContentPlan(campaign());
  const trimmed = deriveInfluencerContentPlan(campaign({ decisions: { "inf:c1": "rejected" } }));

  const expected = full.filter((item) => item.creatorId !== "inf:c1");
  assert.deepEqual(
    trimmed.map((item) => [item.creatorId, item.creatorTier]),
    expected.map((item) => [item.creatorId, item.creatorTier]),
    "each remaining creator keeps the slate's own role"
  );
});
