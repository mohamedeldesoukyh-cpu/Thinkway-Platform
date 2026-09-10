/**
 * Studio showed 3 creators. Content showed 10. Neither was wrong about its own
 * data — the two screens disagreed about who "the campaign creators" are.
 *
 * Content reads the persisted slate (`recommendations.selectedReasoning`)
 * ungated. The Creators screen derived SELECTED from the render-time gate's
 * output and ALTERNATIVES from the ungated pool minus the slate, so a slate
 * member the gate rejected belonged to neither list and was not rendered at
 * all. The other seven were not "moved to an Other bucket" — they were dropped.
 *
 * These tests pin the arithmetic that closes the gap: every hydrated creator
 * lands in exactly one group, every persisted slate id is accounted for, and a
 * gate rejection is never allowed to reduce the recommendation silently.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { extractCampaignFacts } from "@/features/campaign-director/facts/extract-campaign-facts";
import { createEmptyCampaignObject } from "@/features/campaign-intelligence/services/section-updaters";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";

import { deriveInfluencerContentPlan } from "./influencer-content-plan";
import { partitionStudioCreatorGroups } from "./studio-creator-groups";
import { resolveStudioCreatorShortfall } from "./studio-creator-shortfall";
import { creatorGroupingKey } from "./studio-creator-slate-split";

type Row = { id: string; name: string };

const idOf = (row: Row) => row.id;
const normalize = creatorGroupingKey;

function pool(...ids: string[]): Row[] {
  return ids.map((id) => ({ id, name: id.replace(/^\w+:/, "") }));
}

const keys = (rows: Row[]) => rows.map((row) => normalize(row.id));

// ---------------------------------------------------------------------------
// The reproduction: 10 on the slate, 3 past the gate.

test("a slate member the gate rejects is shown, not dropped", () => {
  const slateIds = pool("inf:c1", "inf:c2", "inf:c3", "inf:c4", "inf:c5").map(idOf);
  const hydrated = pool("inf:c1", "inf:c2", "inf:c3", "inf:c4", "inf:c5", "inf:x1", "inf:x2");
  // The gate keeps three slate members and both non-slate creators.
  const gated = hydrated.filter((row) => !["inf:c4", "inf:c5"].includes(row.id));

  const groups = partitionStudioCreatorGroups({ pool: hydrated, gated, slateIds, idOf, normalize });

  assert.deepEqual(keys(groups.selected), ["c1", "c2", "c3"]);
  assert.deepEqual(keys(groups.needsReview), ["c4", "c5"], "the gated-out slate members are visible");
  assert.deepEqual(keys(groups.alternatives), ["x1", "x2"]);
  assert.deepEqual(groups.missingSlateIds, []);
});

test("every hydrated creator lands in exactly one group", () => {
  const hydrated = pool("inf:a", "inf:b", "inf:c", "inf:d", "inf:e");
  const groups = partitionStudioCreatorGroups({
    pool: hydrated,
    gated: pool("inf:a", "inf:d"),
    slateIds: ["inf:a", "inf:b", "inf:c"],
    idOf,
    normalize,
  });

  const placed = [...keys(groups.selected), ...keys(groups.needsReview), ...keys(groups.alternatives)];
  assert.equal(placed.length, hydrated.length, "no creator is dropped and none is duplicated");
  assert.equal(new Set(placed).size, placed.length);
  assert.deepEqual([...placed].sort(), ["a", "b", "c", "d", "e"]);
});

test("a slate id is never in both the recommendation and the alternatives", () => {
  const groups = partitionStudioCreatorGroups({
    pool: pool("inf:a", "inf:b"),
    gated: pool("inf:a", "inf:b"),
    slateIds: ["inf:a"],
    idOf,
    normalize,
  });
  const selectedKeys = new Set(keys(groups.selected));
  for (const row of groups.alternatives) {
    assert.equal(selectedKeys.has(normalize(row.id)), false, row.id);
  }
  for (const row of groups.needsReview) {
    assert.equal(selectedKeys.has(normalize(row.id)), false, row.id);
  }
});

test("id prefixes do not split one creator across two groups", () => {
  // Hydration reports `dis:` / bare ids for creators the slate stored as `inf:`.
  const groups = partitionStudioCreatorGroups({
    pool: pool("dis:a", "b"),
    gated: pool("dis:a", "b"),
    slateIds: ["inf:a", "inf:b"],
    idOf,
    normalize,
  });
  assert.deepEqual(keys(groups.selected), ["a", "b"]);
  assert.deepEqual(groups.alternatives, []);
  assert.deepEqual(groups.missingSlateIds, []);
});

test("a slate id that never hydrated is reported, not counted as recommended", () => {
  const groups = partitionStudioCreatorGroups({
    pool: pool("inf:a"),
    gated: pool("inf:a"),
    slateIds: ["inf:a", "inf:ghost"],
    idOf,
    normalize,
  });
  assert.deepEqual(keys(groups.selected), ["a"]);
  assert.deepEqual(groups.missingSlateIds, ["inf:ghost"], "a rendering loss is named");
});

test("10 requested and 10 recommended shows all 10, with no shortfall claim", () => {
  const ids = Array.from({ length: 10 }, (_, i) => `inf:c${i + 1}`);
  const hydrated = pool(...ids, "inf:alt1");
  const groups = partitionStudioCreatorGroups({
    pool: hydrated,
    gated: hydrated,
    slateIds: ids,
    idOf,
    normalize,
  });

  assert.equal(groups.selected.length, 10, "the recommendation is not truncated to three");
  assert.equal(groups.needsReview.length, 0);
  assert.deepEqual(keys(groups.alternatives), ["alt1"]);

  const shortfall = resolveStudioCreatorShortfall({
    requestedCount: 10,
    recommendedCount: groups.selected.length,
  });
  assert.equal(shortfall.hasShortfall, false);
});

test("a gate rejection reduces the recommendation only with the shortfall stated", () => {
  const ids = Array.from({ length: 10 }, (_, i) => `inf:c${i + 1}`);
  const hydrated = pool(...ids);
  const gated = hydrated.slice(0, 3);
  const groups = partitionStudioCreatorGroups({
    pool: hydrated,
    gated,
    slateIds: ids,
    idOf,
    normalize,
  });

  assert.equal(groups.selected.length, 3);
  assert.equal(groups.needsReview.length, 7, "the other seven are on screen, in their own group");

  const shortfall = resolveStudioCreatorShortfall({
    requestedCount: 10,
    recommendedCount: groups.selected.length,
  });
  assert.equal(shortfall.hasShortfall, true);
  assert.equal(shortfall.requested, 10, "the requested count is never rewritten to 3");
  assert.match(shortfall.summary!, /7 creators shortfall/);
});

test("the alternatives count is the pool outside the slate, not the shortfall", () => {
  // 40 alternatives beside a 3-creator recommendation was the hydrated pool
  // minus the slate. It is a pool size, and it must not absorb slate members.
  const slateIds = Array.from({ length: 10 }, (_, i) => `inf:c${i + 1}`);
  const alternates = Array.from({ length: 40 }, (_, i) => `inf:p${i + 1}`);
  const hydrated = pool(...slateIds, ...alternates);
  const groups = partitionStudioCreatorGroups({
    pool: hydrated,
    gated: pool(...slateIds.slice(0, 3), ...alternates),
    slateIds,
    idOf,
    normalize,
  });

  assert.equal(groups.alternatives.length, 40);
  assert.equal(groups.selected.length + groups.needsReview.length, 10);
});

// ---------------------------------------------------------------------------
// Content and the Creators screen read one list.

const BRIEF = [
  "Client: Kerastase.",
  "Brand: Kerastase.",
  "Market: Saudi Arabia.",
  "Budget: SAR 900,000.",
  "Duration: 6 weeks.",
  "Objective: Brand awareness.",
].join(" ");

function campaignWithSlate(count: number): CampaignObject {
  const object = createEmptyCampaignObject({
    id: "kerastase-groups",
    conversationId: "conv-kerastase",
    workflowId: "create-campaign",
  });
  object.meta.campaignFacts = {
    ...extractCampaignFacts({ rawMessage: BRIEF }),
    brandName: "Kerastase",
    objective: "Brand awareness",
    geography: ["Saudi Arabia"],
    platforms: ["Instagram", "TikTok"],
    durationWeeks: 6,
  };
  const selectedReasoning = Array.from({ length: count }, (_, i) => ({
    creatorId: `inf:c${i + 1}`,
    displayName: `Creator ${i + 1}`,
    handle: `@c${i + 1}`,
    platform: i % 2 === 0 ? "instagram" : "tiktok",
    whySelected: `Category fit ${i + 1}`,
    expectedRole: i < 4 ? "Macro" : i < 7 ? "Mid" : "Micro",
  }));
  object.sections.creators.data = {
    phase: "proposal",
    recommendations: {
      creatorIds: selectedReasoning.map((row) => row.creatorId),
      selectedReasoning,
    },
  } as unknown as Record<string, unknown>;
  return object;
}

test("Content's creators are exactly the campaign's persisted recommendation", () => {
  const object = campaignWithSlate(10);
  const creatorsData = object.sections.creators.data as CreatorsSectionData;
  const canonical = (creatorsData.recommendations?.selectedReasoning ?? []).map(
    (row) => row.creatorId
  );

  const plan = deriveInfluencerContentPlan(object);
  assert.deepEqual(
    plan.map((item) => item.creatorId),
    canonical,
    "Content must never hold a second, independent creator list"
  );
});

test("no creator Content plans for can be missing from the Creators screen", () => {
  // The gate rejects seven of the ten. Content still plans for all ten, so all
  // ten must be accounted for on the Creators screen — recommended or held for
  // review, never absent.
  const object = campaignWithSlate(10);
  const plan = deriveInfluencerContentPlan(object);
  const slateIds = plan.map((item) => item.creatorId);
  const hydrated = pool(...slateIds);

  const groups = partitionStudioCreatorGroups({
    pool: hydrated,
    gated: hydrated.slice(0, 3),
    slateIds,
    idOf,
    normalize,
  });

  const onScreen = new Set([...keys(groups.selected), ...keys(groups.needsReview)]);
  for (const id of slateIds) {
    assert.equal(onScreen.has(normalize(id)), true, `${id} is planned by Content but not on screen`);
  }
  assert.deepEqual(groups.missingSlateIds, []);
});

test("Content's creator tier is the slate's role, not a re-derived tier", () => {
  const object = campaignWithSlate(10);
  const creatorsData = object.sections.creators.data as CreatorsSectionData;
  const roles = (creatorsData.recommendations?.selectedReasoning ?? []).map(
    (row) => row.expectedRole
  );

  const plan = deriveInfluencerContentPlan(object);
  assert.deepEqual(
    plan.map((item) => item.creatorTier),
    roles,
    "a second tier derivation would let Content and Strategy disagree"
  );
  assert.deepEqual(
    plan.map((item) => item.creatorRole),
    roles
  );
});

test("Content keeps the recommendation's order", () => {
  const object = campaignWithSlate(6);
  const creatorsData = object.sections.creators.data as CreatorsSectionData;
  const canonical = (creatorsData.recommendations?.selectedReasoning ?? []).map(
    (row) => row.creatorId
  );
  assert.deepEqual(deriveInfluencerContentPlan(object).map((i) => i.creatorId), canonical);
});
