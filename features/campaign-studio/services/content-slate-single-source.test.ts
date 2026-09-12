/**
 * Content consumes the campaign's working creator slate. Nothing else.
 *
 * Content must never rebuild "the campaign creators" from the ranked pool, the
 * Discovery pool, an arbitrary top-N, or old workflow state — a second list
 * silently representing the same thing is what produced ten creators in Content
 * beside three in Studio.
 *
 * These tests drive the real edit path (`previewCreatorsSectionFromDraft`, the
 * same projection the Studio screens read while a draft is staged) and assert
 * that Content follows it exactly: add, remove, replace, and an operator
 * rejection.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { createEmptyCampaignObject } from "@/features/campaign-intelligence/services/section-updaters";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type {
  CreatorsSectionData,
  StudioDraftChange,
} from "@/features/campaign-intelligence/types/section-schemas";

import { deriveInfluencerContentPlan } from "./influencer-content-plan";
import { previewCreatorsSectionFromDraft } from "./studio-draft-preview";
import { creatorGroupingKey } from "./studio-creator-slate-split";

const SLATE_SIZE = 10;

function campaign(): CampaignObject {
  const object = createEmptyCampaignObject({
    id: "kerastase-content",
    conversationId: "conv-kerastase-content",
    workflowId: "create-campaign",
  });
  object.meta.campaignFacts = {
    extractedAt: new Date().toISOString(),
    confidence: {},
    sources: {},
    brandName: "Kerastase",
    product: "Ramadan 2026 haircare",
    objective: "Brand awareness",
    geography: ["Egypt"],
    platforms: ["Instagram", "TikTok"],
    durationWeeks: 6,
  } as CampaignObject["meta"]["campaignFacts"];

  const selectedReasoning = Array.from({ length: SLATE_SIZE }, (_, i) => ({
    creatorId: `inf:c${i + 1}`,
    displayName: `Creator ${i + 1}`,
    handle: `@c${i + 1}`,
    platform: i % 2 === 0 ? "instagram" : "tiktok",
    whySelected: `Egyptian haircare audience ${i + 1}`,
    expectedRole: i < 4 ? "Macro" : i < 7 ? "Mid" : "Micro",
    audienceMatch: "Egypt 20–40",
    risk: "Low",
    alternative: "—",
    confidence: 0.7,
    evidence: "Category + market",
    tradeoff: "—",
  }));

  const creatorsData: CreatorsSectionData = {
    phase: "proposal",
    // A pool far larger than the slate: if Content ever reached for the pool or
    // a top-N, these counts would diverge.
    discovery: {
      creatorIds: [
        ...selectedReasoning.map((row) => row.creatorId),
        ...Array.from({ length: 40 }, (_, i) => `inf:p${i + 1}`),
      ],
      total: 62,
    },
    recommendations: {
      creatorIds: selectedReasoning.map((row) => row.creatorId),
      selectedReasoning,
    },
  };
  object.sections.creators.data = creatorsData as unknown as Record<string, unknown>;
  return object;
}

function withDraft(object: CampaignObject, changes: StudioDraftChange[]): CampaignObject {
  const next = structuredClone(object);
  const previewed = previewCreatorsSectionFromDraft(next, {
    changes,
    updatedAt: new Date().toISOString(),
  });
  next.sections.creators.data = previewed as unknown as Record<string, unknown>;
  return next;
}

const slateIds = (object: CampaignObject) =>
  (object.sections.creators.data as CreatorsSectionData).recommendations?.creatorIds ?? [];
const contentIds = (object: CampaignObject) =>
  deriveInfluencerContentPlan(object).map((item) => item.creatorId!);
const stamped = new Date().toISOString();

// ---------------------------------------------------------------------------
// The identity: recommended === canonical slate === Content.

test("10 creators on the slate are exactly the 10 in Content", () => {
  const object = campaign();
  assert.equal(slateIds(object).length, SLATE_SIZE);
  assert.deepEqual(contentIds(object), slateIds(object));
});

test("Content never reaches into the Discovery pool", () => {
  const object = campaign();
  const pool = (object.sections.creators.data as CreatorsSectionData).discovery?.creatorIds ?? [];
  assert.equal(pool.length, 50, "the pool is deliberately much larger than the slate");
  assert.equal(contentIds(object).length, SLATE_SIZE);
  for (const id of contentIds(object)) {
    assert.ok(slateIds(object).includes(id), `${id} is not on the campaign slate`);
  }
});

test("no duplicate canonical id reaches Content", () => {
  const ids = contentIds(campaign()).map(creatorGroupingKey);
  assert.equal(new Set(ids).size, ids.length);
});

// ---------------------------------------------------------------------------
// Edits: Content follows the slate through the real edit path.

test("adding a creator adds it to Content", () => {
  const object = withDraft(campaign(), [
    {
      kind: "add_creator",
      creator: {
        creatorId: "inf:new1",
        displayName: "New Creator",
        handle: "@new1",
        platform: "instagram",
        source: "discovery",
      },
      stagedAt: stamped,
    },
  ]);

  assert.equal(slateIds(object).length, SLATE_SIZE + 1);
  assert.deepEqual(contentIds(object), slateIds(object));
  assert.ok(contentIds(object).includes("inf:new1"));
});

test("removing a creator removes it from Content", () => {
  const object = withDraft(campaign(), [
    { kind: "remove_creator", creatorId: "inf:c4", stagedAt: stamped },
  ]);

  assert.equal(slateIds(object).length, SLATE_SIZE - 1);
  assert.deepEqual(contentIds(object), slateIds(object));
  assert.ok(!contentIds(object).includes("inf:c4"));
});

test("replacing a creator swaps it in Content", () => {
  const object = withDraft(campaign(), [
    {
      kind: "replace_creator",
      creatorId: "inf:c2",
      replacement: {
        creatorId: "inf:sub2",
        displayName: "Substitute",
        handle: "@sub2",
        platform: "tiktok",
        source: "discovery",
      },
      stagedAt: stamped,
    },
  ]);

  const ids = contentIds(object);
  assert.deepEqual(ids, slateIds(object));
  assert.ok(!ids.includes("inf:c2"), "the replaced creator is gone from Content");
  assert.ok(ids.includes("inf:sub2"), "the replacement is in Content");
  assert.equal(ids.length, SLATE_SIZE);
});

test("a rejected creator is not silently left in Content", () => {
  const object = withDraft(campaign(), [
    { kind: "reject_creator", creatorId: "inf:c7", stagedAt: stamped },
  ]);

  // Rejection does not change slate MEMBERSHIP — that is the contract.
  assert.equal(slateIds(object).length, SLATE_SIZE);
  // But Content plans only for the campaign's active creators.
  const ids = contentIds(object);
  assert.equal(ids.length, SLATE_SIZE - 1);
  assert.ok(!ids.includes("inf:c7"));
});

test("approving or shortlisting changes nothing about who is in Content", () => {
  for (const kind of ["approve_creator", "shortlist_creator"] as const) {
    const object = withDraft(campaign(), [
      { kind, creatorId: "inf:c3", stagedAt: stamped } as StudioDraftChange,
    ]);
    assert.deepEqual(contentIds(object), slateIds(object), kind);
    assert.equal(contentIds(object).length, SLATE_SIZE, kind);
  }
});

test("several edits at once keep Content and the slate identical", () => {
  const object = withDraft(campaign(), [
    { kind: "remove_creator", creatorId: "inf:c1", stagedAt: stamped },
    {
      kind: "add_creator",
      creator: { creatorId: "inf:new9", displayName: "Nine", source: "discovery" },
      stagedAt: stamped,
    },
    { kind: "reject_creator", creatorId: "inf:c5", stagedAt: stamped },
  ]);

  const slate = slateIds(object);
  const content = contentIds(object);
  assert.ok(!slate.includes("inf:c1"));
  assert.ok(slate.includes("inf:new9"));
  assert.ok(slate.includes("inf:c5"), "a rejection keeps membership");
  assert.ok(!content.includes("inf:c5"), "and removes it from the plan");
  assert.equal(content.length, slate.length - 1);
  assert.equal(new Set(content.map(creatorGroupingKey)).size, content.length);
});

// ---------------------------------------------------------------------------
// Ordering and tier role.

test("Content keeps the slate's order and each creator's own role", () => {
  const object = withDraft(campaign(), [
    { kind: "remove_creator", creatorId: "inf:c3", stagedAt: stamped },
  ]);
  const rows =
    (object.sections.creators.data as CreatorsSectionData).recommendations?.selectedReasoning ?? [];
  const plan = deriveInfluencerContentPlan(object);

  assert.deepEqual(plan.map((item) => item.creatorId), rows.map((row) => row.creatorId));
  assert.deepEqual(plan.map((item) => item.creatorTier), rows.map((row) => row.expectedRole));
  assert.deepEqual(plan.map((item) => item.creatorRole), rows.map((row) => row.expectedRole));
});

// ---------------------------------------------------------------------------
// Source contract: no second creator list in the Content path.

test("the Content plan reads only the campaign's recommendation rows", () => {
  const source = readFileSync("features/campaign-studio/services/content-context.ts", "utf8");
  assert.match(source, /recommendations\?\.selectedReasoning/);
  // Never the pool, never a top-N of creators, never ranked search output.
  // (`strategyText.slice(0, 280)` truncates narrative text, not the slate.)
  assert.doesNotMatch(source, /discovery\?\.creatorIds/);
  assert.doesNotMatch(source, /reasoning\.slice\(/);
  assert.doesNotMatch(source, /selectedReasoning[^\n]*\.slice\(/);
  assert.doesNotMatch(source, /rankCreators|searchResults|poolCreators/);
});

test("the client-facing content projection goes through that one derivation", () => {
  const source = readFileSync("features/client-workspace/project-client-view.ts", "utf8");
  assert.match(source, /deriveInfluencerContentPlan\(campaignObject\)/);
  assert.doesNotMatch(source, /discovery\?\.creatorIds/);
});
