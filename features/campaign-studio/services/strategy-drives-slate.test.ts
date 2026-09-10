/**
 * The approved Strategy drives the creator slate.
 *
 * The Strategy document lives on workflow state; the campaign object has no
 * field for it. So the slate used to fall back to the industry mix derived from
 * Campaign Facts — and the Director debate can replace `creatorTierStrategy`
 * with a materially different allocation. The campaign then stated one creator
 * mix in its narrative and recommended creators following another.
 *
 * The Strategy is now threaded from workflow state the same way validated
 * intelligence already is. These tests pin that, and pin the fallback for
 * callers that have no Strategy to give.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";
import { buildCreatorMixFromFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import {
  applyTaskResultToCampaignObject,
  createEmptyCampaignObject,
} from "@/features/campaign-intelligence/services/section-updaters";

import { proposeInitialCreatorSlateWithStatus } from "./propose-creator-slate";

const FOLLOWERS: Record<string, number> = {
  nano: 5_000,
  micro: 50_000,
  mid: 250_000,
  macro: 750_000,
  mega: 2_000_000,
  celebrity: 8_000_000,
};

function creator(tier: string, index: number) {
  return {
    id: `${tier}-${index}`,
    handle: `${tier}_${index}`,
    displayName: `${tier} ${index}`,
    platform: "instagram",
    followers: FOLLOWERS[tier],
    engagementRate: 3,
    categories: ["Technology"],
    campaignRelevanceScore: 80 - index,
  };
}

/** Deep inventory in every tier, so the mix decides the slate — not supply. */
const POOL = Object.keys(FOLLOWERS).flatMap((tier) =>
  Array.from({ length: 14 }, (_, i) => creator(tier, i))
) as never[];

/**
 * Telecom facts. `buildCreatorMixFromFacts` returns a Celebrity-led mix here,
 * so a Strategy without Celebrity is unmistakably a different instruction.
 */
const FACTS = {
  brandName: "Etisalat",
  clientName: "Etisalat",
  industry: "Telecom",
  objective: "Launch 5G with mass awareness",
  durationWeeks: 8,
  platforms: ["instagram"],
  geography: ["Egypt"],
  audience: "Egyptian Gen Z",
  creatorCategories: ["Technology"],
  deliverables: [],
  kpis: [],
  extractedAt: "",
  confidence: {},
  sources: {},
};

/** What the Director debate can produce — no Celebrity, Micro/Nano heavy. */
const STRATEGY_TIERS = [
  { tier: "Macro", allocationPercent: 20, why: "Reach anchor" },
  { tier: "Micro", allocationPercent: 40, why: "Community depth" },
  { tier: "Nano", allocationPercent: 40, why: "Authentic UGC volume" },
];

function strategyDoc(
  overrides?: Partial<CampaignStrategyDocument>
): CampaignStrategyDocument {
  return {
    id: "strategy-approved",
    version: 3,
    createdAt: "2026-01-01T00:00:00.000Z",
    understanding: {
      brand: "Etisalat",
      objective: "Launch 5G with mass awareness",
      geography: "Egypt",
      audience: "Egyptian Gen Z",
      platforms: ["Instagram"],
      kpis: [],
      risks: [],
      constraints: [],
    },
    narrative: "5G launch.",
    pillars: [{ title: "Technology", what: "5G in daily life", why: "Relevance" }],
    platformMix: [{ platform: "Instagram", role: "Reels", why: "Reach" }],
    creatorTierStrategy: STRATEGY_TIERS,
    ...overrides,
  } as CampaignStrategyDocument;
}

/** A production-shaped object — the real factory, so no section is missing. */
function campaignObject(): CampaignObject {
  const base = createEmptyCampaignObject({
    id: "co-1",
    conversationId: "conv-1",
    workflowId: "create-campaign",
  });
  return {
    ...base,
    meta: { ...base.meta, status: "complete", campaignFacts: FACTS },
  } as unknown as CampaignObject;
}

function creatorsOf(object: CampaignObject): CreatorsSectionData {
  return (object.sections.creators.data ?? {}) as CreatorsSectionData;
}

function tierCounts(ids: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of ids) {
    const tier = id.split("-")[0]!;
    out[tier] = (out[tier] ?? 0) + 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// A — the Strategy mix overrides the industry/facts fallback.

test("the approved Strategy mix overrides the industry mix from Campaign Facts", () => {
  // Guard: the two sources really do disagree, or this test proves nothing.
  const factsMix = buildCreatorMixFromFacts(FACTS as never);
  assert.ok(
    factsMix.some((tier) => tier.tier === "Celebrity"),
    "guard: the facts mix for Telecom is expected to lead with Celebrity"
  );
  assert.ok(!STRATEGY_TIERS.some((tier) => tier.tier === "Celebrity"));

  const result = proposeInitialCreatorSlateWithStatus(campaignObject(), {
    poolCreators: POOL,
    strategy: strategyDoc(),
  });
  const data = creatorsOf(result.campaignObject);

  assert.deepEqual(
    (data.slateComposition?.requestedMix ?? []).map((m) => `${m.tier} ${m.percent}`),
    ["Macro 20", "Micro 40", "Nano 40"]
  );
  const counts = tierCounts(data.recommendations?.creatorIds ?? []);
  assert.equal(counts.celebrity ?? 0, 0, "the facts mix must not decide the slate");
  assert.ok((counts.micro ?? 0) > 0 && (counts.nano ?? 0) > 0);
});

// ---------------------------------------------------------------------------
// B — the real production path carries it.

test("the production task-result path passes the Strategy from workflow state", () => {
  const stateData = {
    campaignStrategyDocument: strategyDoc(),
    campaignFacts: FACTS,
    searchResults: POOL,
    // Minimal approved pipeline — the branch that proposes the slate.
    directorPipeline: {
      approvalGate: { approved: true, unresolvedConflictCount: 0, revisionRounds: 0 },
      approvedSections: [],
      strategyDocument: strategyDoc(),
      reviewReport: {},
    },
  } as unknown as Record<string, unknown>;

  const updated = applyTaskResultToCampaignObject(
    campaignObject(),
    {
      // A task that writes no creators itself, so the director-approved
      // proposal branch is the only thing composing the slate.
      taskId: "generate-timeline",
      status: "completed",
      agentId: "scout",
      content: "",
      startedAt: "2026-02-01T00:00:00.000Z",
      completedAt: "2026-02-01T00:00:00.000Z",
    } as never,
    stateData
  );

  const data = creatorsOf(updated);
  assert.ok(
    (data.recommendations?.creatorIds?.length ?? 0) > 0,
    "guard: the production path must actually propose a slate here"
  );
  assert.deepEqual(
    (data.slateComposition?.requestedMix ?? []).map((m) => m.tier),
    ["Macro", "Micro", "Nano"],
    "the slate must be composed to the workflow-state Strategy, not the facts mix"
  );
  assert.equal(tierCounts(data.recommendations!.creatorIds).celebrity ?? 0, 0);
});

// ---------------------------------------------------------------------------
// C — CSR gets a real strategyRef.

test("CSR carries a strategyRef taken from the approved Strategy", () => {
  const result = proposeInitialCreatorSlateWithStatus(campaignObject(), {
    poolCreators: POOL,
    strategy: strategyDoc(),
  });

  const csr = creatorsOf(result.campaignObject).searchRequirements;
  assert.ok(csr, "CSR must be attached");
  assert.deepEqual(csr!.strategyRef, {
    id: "strategy-approved",
    version: 3,
    createdAt: "2026-01-01T00:00:00.000Z",
  });
});

// ---------------------------------------------------------------------------
// D — a changed Strategy reaches the next proposal.

test("a changed Strategy changes the next proposal and refreshes CSR", () => {
  const first = proposeInitialCreatorSlateWithStatus(campaignObject(), {
    poolCreators: POOL,
    strategy: strategyDoc(),
  });
  const firstData = creatorsOf(first.campaignObject);

  // A new Director run selects a different allocation, at a new revision.
  const changed = strategyDoc({
    version: 4,
    creatorTierStrategy: [
      { tier: "Mega", allocationPercent: 50, why: "Mass awareness anchor" },
      { tier: "Macro", allocationPercent: 50, why: "Reach amplification" },
    ],
  });

  // Re-proposal runs on a fresh object — the committed-slate gate is unrelated
  // to Strategy freshness and is deliberately left alone.
  const second = proposeInitialCreatorSlateWithStatus(campaignObject(), {
    poolCreators: POOL,
    strategy: changed,
  });
  const secondData = creatorsOf(second.campaignObject);

  assert.deepEqual(
    (secondData.slateComposition?.requestedMix ?? []).map((m) => `${m.tier} ${m.percent}`),
    ["Mega 50", "Macro 50"]
  );
  const counts = tierCounts(secondData.recommendations?.creatorIds ?? []);
  assert.ok((counts.mega ?? 0) > 0, "the new Strategy's Mega tier must be recommended");
  assert.equal(counts.nano ?? 0, 0, "the previous Strategy's Nano tier must not persist");
  assert.notEqual(
    secondData.searchRequirements?.strategyRef?.version,
    firstData.searchRequirements?.strategyRef?.version
  );
  assert.equal(secondData.searchRequirements?.strategyRef?.version, 4);
});

// ---------------------------------------------------------------------------
// F — unchanged when no Strategy is available.

test("with no Strategy the slate keeps the existing facts-derived behaviour", () => {
  const result = proposeInitialCreatorSlateWithStatus(campaignObject(), {
    poolCreators: POOL,
  });
  const data = creatorsOf(result.campaignObject);

  assert.deepEqual(
    (data.slateComposition?.requestedMix ?? []).map((m) => `${m.tier} ${m.percent}`),
    buildCreatorMixFromFacts(FACTS as never).map((m) => `${m.tier} ${m.percent}`),
    "the industry mix from Campaign Facts still applies when no Strategy is given"
  );
  assert.equal(data.searchRequirements?.strategyRef, undefined);
});
