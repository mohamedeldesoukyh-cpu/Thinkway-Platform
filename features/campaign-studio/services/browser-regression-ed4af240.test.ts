/**
 * The three contradictions real browser acceptance found on develop 9086fb11,
 * after the earlier state-consistency pass. Each one is here because a previous
 * test was insufficient, so each is pinned at the exact seam that failed.
 *
 *   1. Creators and Campaign Analysis reported 10 creators; Content rendered 6;
 *      the Package footer said "6 vendor(s)". The two halves of one persisted
 *      `recommendations` object had drifted: `creatorIds` held 10 ids,
 *      `selectedReasoning` held 6 rows. Every earlier Content test built
 *      fixtures where the two were equal by construction, so none of them could
 *      see it.
 *   2. Strategy showed "Micro + Mid + Macro + Nano · 35 / 30 / 20 / 15" with
 *      "the brief did not specify one" on one card and "grounded in the brief
 *      and approved strategy" on another.
 *   3. Package said "Strategy BLOCKED — has not been generated" while the
 *      Strategy screen rendered a complete strategy.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { extractCampaignFacts } from "@/features/campaign-director/facts/extract-campaign-facts";
import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import { createEmptyCampaignObject } from "@/features/campaign-intelligence/services/section-updaters";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type {
  CreatorsSectionData,
  StudioDraftChange,
  VendorSelectedReasoning,
} from "@/features/campaign-intelligence/types/section-schemas";
import { buildExecutiveStrategyReasoning } from "@/features/campaign-intelligence/services/reasoning/executive-strategy-reasoning";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";

import {
  checkCreatorSlateIntegrity,
  reconcileCreatorSlateReasoning,
} from "./creator-slate-integrity";
import { deriveInfluencerContentPlan } from "./influencer-content-plan";
import { creatorGroupingKey } from "./studio-creator-slate-split";
import { previewCreatorsSectionFromDraft } from "./studio-draft-preview";
import { resolveStudioPackageReadiness } from "./studio-package-readiness";

// ---------------------------------------------------------------------------
// The Kérastase campaign, as the browser showed it.

const TEN_IDS = Array.from({ length: 10 }, (_, i) => `inf:k${i + 1}`);

function reasoningRow(id: string, index: number): VendorSelectedReasoning {
  return {
    creatorId: id,
    displayName: `Creator ${index + 1}`,
    handle: `@k${index + 1}`,
    platform: index % 2 === 0 ? "instagram" : "tiktok",
    whySelected: `Egyptian haircare audience ${index + 1}`,
    expectedRole: index < 3 ? "Mid" : "Micro",
    audienceMatch: "Egypt 20–40",
    risk: "Low",
    alternative: "—",
    confidence: 0.7,
    evidence: "Category + market",
    tradeoff: "—",
  };
}

/** `reasoningCount` rows for a ten-id slate — the drift the browser exposed. */
function kerastase(reasoningCount = 10): CampaignObject {
  const object = createEmptyCampaignObject({
    id: "kerastase-browser",
    conversationId: "conv-kerastase-browser",
    workflowId: "create-campaign",
  });
  object.meta.factsConfirmedAt = new Date().toISOString();
  object.meta.campaignFacts = {
    extractedAt: new Date().toISOString(),
    confidence: {},
    sources: {},
    clientName: "Kérastase",
    brandName: "Kérastase",
    product: "Ramadan 2026 haircare",
    objective: "Drive Consideration & Conversion",
    audience: "Women aged 20–40 in Egypt",
    geography: ["Egypt"],
    platforms: ["Instagram", "TikTok"],
    budget: { amount: 3_000_000, currency: "EGP" },
    durationWeeks: 4,
    industry: "Beauty & Personal Care",
  } as CampaignFacts;

  const creatorsData: CreatorsSectionData = {
    phase: "proposal",
    discovery: { creatorIds: [...TEN_IDS], total: 62 },
    recommendations: {
      creatorIds: [...TEN_IDS],
      selectedReasoning: TEN_IDS.slice(0, reasoningCount).map(reasoningRow),
    },
    lastDiscoveryAt: new Date().toISOString(),
  };
  object.sections.creators.data = creatorsData as unknown as Record<string, unknown>;
  object.sections.creators.status = "complete";
  return object;
}

const contentIds = (object: CampaignObject) =>
  deriveInfluencerContentPlan(object).map((item) => item.creatorId!);
const slateIds = (object: CampaignObject) =>
  (object.sections.creators.data as CreatorsSectionData).recommendations?.creatorIds ?? [];

// ---------------------------------------------------------------------------
// A. The reproduction: 10 ids, 6 reasoning rows.

test("A. a 10-id slate with only 6 reasoning rows still renders 10 in Content", () => {
  const object = kerastase(6);
  const data = object.sections.creators.data as CreatorsSectionData;

  // The exact persisted shape the browser was reading.
  assert.equal(data.recommendations?.creatorIds?.length, 10);
  assert.equal(data.recommendations?.selectedReasoning?.length, 6);

  assert.deepEqual(
    contentIds(object),
    TEN_IDS,
    "Content membership is the canonical slate, not the reasoning array"
  );
});

test("A. the drift is detected rather than silently absorbed", () => {
  const drifted = checkCreatorSlateIntegrity(
    (kerastase(6).sections.creators.data as CreatorsSectionData).recommendations,
    creatorGroupingKey
  );
  assert.equal(drifted.consistent, false);
  assert.deepEqual(drifted.missingReasoningIds, TEN_IDS.slice(6));
  assert.deepEqual(drifted.orphanReasoningIds, []);

  const clean = checkCreatorSlateIntegrity(
    (kerastase(10).sections.creators.data as CreatorsSectionData).recommendations,
    creatorGroupingKey
  );
  assert.equal(clean.consistent, true);
});

test("A. a creator with no rationale says so, and invents no metric", () => {
  const plan = deriveInfluencerContentPlan(kerastase(6));
  const synthesised = plan[9]!;

  assert.equal(synthesised.creatorId, "inf:k10");
  assert.match(synthesised.hook ?? "", /rationale is not recorded/i);
  assert.equal(synthesised.creatorTier, "Creator", "no tier is guessed");
  // Identity only: the row carries no fabricated audience, risk or confidence.
  const row = reconcileCreatorSlateReasoning({
    creatorIds: ["inf:k10"],
    selectedReasoning: [],
    normalize: creatorGroupingKey,
  })[0]!;
  assert.equal(row.audienceMatch, "");
  assert.equal(row.risk, "");
  assert.equal(row.evidence, "");
  assert.equal(row.confidence, 0);
});

test("A. Content and the canonical slate agree for every reasoning-row count", () => {
  for (const count of [0, 1, 6, 9, 10]) {
    const object = kerastase(count);
    assert.deepEqual(contentIds(object), TEN_IDS, `reasoning rows: ${count}`);
  }
});

test("A. an orphan reasoning row cannot put a creator in Content", () => {
  // A row whose creator has left the slate must not resurrect it.
  const object = kerastase(10);
  const data = object.sections.creators.data as CreatorsSectionData;
  data.recommendations!.creatorIds = TEN_IDS.slice(0, 8);
  assert.deepEqual(contentIds(object), TEN_IDS.slice(0, 8));
});

// ---------------------------------------------------------------------------
// B. Slate mutations, from the drifted state.

const stamped = new Date().toISOString();

function withDraft(object: CampaignObject, changes: StudioDraftChange[]): CampaignObject {
  const next = structuredClone(object);
  next.sections.creators.data = previewCreatorsSectionFromDraft(next, {
    changes,
    updatedAt: stamped,
  }) as unknown as Record<string, unknown>;
  return next;
}

test("B. add a creator — Content follows, from a drifted slate", () => {
  const object = withDraft(kerastase(6), [
    {
      kind: "add_creator",
      creator: { creatorId: "inf:new", displayName: "New", source: "discovery" },
      stagedAt: stamped,
    },
  ]);
  assert.equal(slateIds(object).length, 11);
  assert.deepEqual(contentIds(object), slateIds(object));
});

test("B. remove a creator — including one that had no reasoning row", () => {
  for (const removed of ["inf:k2", "inf:k9"]) {
    const object = withDraft(kerastase(6), [
      { kind: "remove_creator", creatorId: removed, stagedAt: stamped },
    ]);
    assert.equal(slateIds(object).length, 9, removed);
    assert.deepEqual(contentIds(object), slateIds(object), removed);
    assert.ok(!contentIds(object).includes(removed), removed);
  }
});

test("B. replace a creator that had no reasoning row", () => {
  const object = withDraft(kerastase(6), [
    {
      kind: "replace_creator",
      creatorId: "inf:k8",
      replacement: { creatorId: "inf:sub", displayName: "Sub", source: "discovery" },
      stagedAt: stamped,
    },
  ]);
  const ids = contentIds(object);
  assert.deepEqual(ids, slateIds(object));
  assert.ok(!ids.includes("inf:k8"));
  assert.ok(ids.includes("inf:sub"));
  assert.equal(ids.length, 10);
});

test("B. 10 → 9 and 10 → 12 both keep Content equal to the slate", () => {
  const nine = withDraft(kerastase(6), [
    { kind: "remove_creator", creatorId: "inf:k1", stagedAt: stamped },
  ]);
  assert.equal(contentIds(nine).length, 9);
  assert.deepEqual(contentIds(nine), slateIds(nine));

  const twelve = withDraft(kerastase(6), [
    {
      kind: "add_creator",
      creator: { creatorId: "inf:x1", displayName: "X1", source: "discovery" },
      stagedAt: stamped,
    },
    {
      kind: "add_creator",
      creator: { creatorId: "inf:x2", displayName: "X2", source: "discovery" },
      stagedAt: stamped,
    },
  ]);
  assert.equal(contentIds(twelve).length, 12);
  assert.deepEqual(contentIds(twelve), slateIds(twelve));
});

test("B. a rejected creator leaves Content but stays on the slate", () => {
  const object = withDraft(kerastase(6), [
    { kind: "reject_creator", creatorId: "inf:k3", stagedAt: stamped },
  ]);
  assert.equal(slateIds(object).length, 10);
  assert.equal(contentIds(object).length, 9);
  assert.ok(!contentIds(object).includes("inf:k3"));
});

test("B. no duplicate id ever reaches Content", () => {
  const object = withDraft(kerastase(6), [
    {
      kind: "add_creator",
      creator: { creatorId: "inf:k4", displayName: "Dup", source: "discovery" },
      stagedAt: stamped,
    },
  ]);
  const keys = contentIds(object).map(creatorGroupingKey);
  assert.equal(new Set(keys).size, keys.length);
});

// ---------------------------------------------------------------------------
// C. Strategy: Nano is a recommendation, and is never claimed as the brief's.

const KERASTASE_BRIEF = [
  "Client: Kérastase.",
  "Brand: Kérastase.",
  "Market: Egypt.",
  "Budget: EGP 3,000,000.",
  "Duration: 4 weeks.",
  "Objective: Drive consideration and conversion.",
  "Audience: Women aged 20-40 in Egypt interested in premium haircare.",
].join(" ");

/**
 * A stored Strategy with NO tier allocation of its own, so the mix resolves
 * from Campaign Facts — which is the state the browser showed.
 */
function strategyDoc(): CampaignStrategyDocument {
  return {
    id: "strategy-kerastase",
    version: 1,
    createdAt: new Date().toISOString(),
    understanding: {
      brand: "Kérastase",
      objective: "Drive Consideration & Conversion",
      audience: "Women aged 20–40 in Egypt",
      platforms: ["instagram", "tiktok"],
      kpis: [],
      risks: [],
      constraints: [],
    },
    narrative: "Creator-led consideration and conversion for Kérastase in Egypt.",
    pillars: [],
    platformMix: [],
    creatorTierStrategy: [],
  } as unknown as CampaignStrategyDocument;
}

test("C. a mix the brief did not state is never called brief-grounded", () => {
  const facts = extractCampaignFacts({ rawMessage: KERASTASE_BRIEF });
  // The brief names no tiers, so the mix is Thinkway's industry recommendation.
  assert.equal(facts.creatorTiers?.length ?? 0, 0);

  const reasoning = buildExecutiveStrategyReasoning(facts, strategyDoc());
  assert.doesNotMatch(
    reasoning.directorConclusion,
    /grounded in the confirmed creator mix/i,
    "the brief specified no creator mix"
  );
  assert.match(reasoning.directorConclusion, /recommended by Thinkway/i);
  assert.doesNotMatch(reasoning.chosenStrategy, /Director-approved/);
  assert.match(reasoning.chosenStrategy, /recommended/);
});

test("C. Nano is not deleted — it is labelled as a recommendation", () => {
  const facts = extractCampaignFacts({ rawMessage: KERASTASE_BRIEF });
  const reasoning = buildExecutiveStrategyReasoning(facts, strategyDoc());
  // The mix itself is untouched; only the claim about its origin changed.
  assert.match(reasoning.directorConclusion, /\b(Nano|Micro|Mid|Macro)\b/);
});

test("C. brief-stated tiers still constrain the mix and keep their claim", () => {
  const facts = extractCampaignFacts({
    rawMessage: `${KERASTASE_BRIEF} Preferred creator tiers: Macro 30%, Mid 40%, Micro 30%.`,
  });
  assert.ok((facts.creatorTiers?.length ?? 0) > 0, "the brief's tiers are extracted");

  const reasoning = buildExecutiveStrategyReasoning(facts, strategyDoc());
  assert.match(reasoning.directorConclusion, /grounded in the confirmed creator mix/i);
  assert.doesNotMatch(reasoning.directorConclusion, /Nano/, "a tier the brief excluded");
  assert.match(reasoning.chosenStrategy, /Director-approved/);
});

test("C. an operator-confirmed tier set is authoritative, Nano included", () => {
  const facts: CampaignFacts = {
    ...extractCampaignFacts({ rawMessage: KERASTASE_BRIEF }),
    creatorTiers: [
      { tier: "Nano", percent: 60 },
      { tier: "Micro", percent: 40 },
    ],
    sources: { creatorTiers: "operator" },
  } as CampaignFacts;

  const reasoning = buildExecutiveStrategyReasoning(facts, strategyDoc());
  assert.match(reasoning.directorConclusion, /Nano/, "an explicit choice is respected");
  assert.match(reasoning.directorConclusion, /grounded in the confirmed creator mix/i);
  assert.doesNotMatch(reasoning.directorConclusion, /Macro/);
});

// ---------------------------------------------------------------------------
// D / E / F. Package readiness against the browser state.

const checkOf = (object: CampaignObject, id: string) =>
  resolveStudioPackageReadiness(object).checks.find((item) => item.id === id)!;

test("D. Package cannot claim the Strategy is absent when the screen renders it", () => {
  const object = kerastase();
  const check = checkOf(object, "strategy");
  assert.notEqual(check.state, "blocked", check.reason);
  assert.doesNotMatch(check.reason ?? "", /has not been generated/i);
});

test("E. Package and the mast read one readiness authority", () => {
  const object = kerastase();
  const readiness = resolveStudioPackageReadiness(object);
  // No dimension may be blocked purely because a strategy DOCUMENT was never
  // generated — the same rule the Strategy screen uses decides.
  const blocked = readiness.checks.filter((item) => item.state === "blocked");
  assert.ok(
    !blocked.some((item) => /has not been generated from current facts/i.test(item.reason ?? "")),
    JSON.stringify(blocked.map((item) => [item.id, item.reason]))
  );
});

test("F. a creator enrichment gap is a caution, not a campaign-geography failure", () => {
  const object = kerastase();
  const data = object.sections.creators.data as CreatorsSectionData;
  data.recommendations!.selectedReasoning![0] = {
    ...data.recommendations!.selectedReasoning![0]!,
    missingData: ["Geography"],
  };

  const check = checkOf(object, "discovery");
  // Egypt is confirmed in Campaign Facts.
  assert.deepEqual(object.meta.campaignFacts?.geography, ["Egypt"]);
  assert.notEqual(check.state, "blocked", "creator data completeness is not a planning blocker");
  assert.equal(check.state, "in_progress");
  assert.match(check.reason ?? "", /enrichment records of creators/i);
  assert.doesNotMatch(check.reason ?? "", /Geography is still missing/i);
  assert.match(check.reason ?? "", /not from the campaign's confirmed facts/i);
  // And it still withholds client readiness.
  assert.notEqual(resolveStudioPackageReadiness(object).overall, "ready_for_client");
});
