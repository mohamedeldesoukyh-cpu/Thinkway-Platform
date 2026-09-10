/**
 * Post-apply re-optimization — campaign analysis must never go stale.
 *
 * Add / remove / replace changes the creator slate, so the forecast and health
 * that describe it have to change with it. A Discovery-only slate (every id
 * `dp:` / `dis:`) has nothing to hydrate and so cannot be re-ranked — but it
 * must still not keep analysis computed for the creator set the operator just
 * edited away.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignObject } from "@/features/campaign-intelligence";
import type {
  CreatorsSectionData,
  PerformanceSectionData,
} from "@/features/campaign-intelligence/types/section-schemas";
import type { SupabaseClient } from "@supabase/supabase-js";

import { reoptimizeCampaignAfterApply } from "./apply-draft-reoptimize";

/** Artifacts from an earlier, larger slate — these are the stale values. */
const STALE_FORECAST = {
  engineVersion: 1,
  audienceSize: 9_000_000,
  grossReach: 5_000_000,
  overlapDeduction: 1_000_000,
  estimatedReach: 4_000_000,
  estimatedImpressions: 6_000_000,
  estimatedViews: 5_000_000,
  estimatedEngagements: 150_000,
  averageEngagementRate: 3.5,
  confidenceScore: 80,
  confidenceLabel: "high",
  explanation: ["from a slate that no longer exists"],
  computedAt: "2026-01-01T00:00:00.000Z",
} as unknown as NonNullable<PerformanceSectionData["campaignForecast"]>;

const STALE_SCORES = {
  overall: 88,
  brandFit: 90,
  audienceMatch: 92,
  reach: 85,
  engagementForecast: 80,
  budgetEfficiency: 70,
  contentCoverage: 84,
  risk: 90,
  basis: ["from a slate that no longer exists"],
  updatedAt: "2026-01-01T00:00:00.000Z",
} as unknown as NonNullable<PerformanceSectionData["campaignScores"]>;

function objectWith(creatorIds: string[]): CampaignObject {
  return {
    id: "co-1",
    conversationId: "conv-1",
    workflowId: "create-campaign",
    updatedAt: "2026-02-01T00:00:00.000Z",
    sections: {
      creators: {
        status: "complete",
        content: "",
        data: {
          recommendations: { creatorIds, selectedReasoning: [] },
        } satisfies CreatorsSectionData as unknown as Record<string, unknown>,
      },
      strategy: { status: "complete", content: "" },
      summary: { status: "complete", content: "" },
      timeline: { status: "complete", content: "", data: {} },
      performance: {
        status: "complete",
        content: "",
        data: {
          campaignForecast: STALE_FORECAST,
          campaignScores: STALE_SCORES,
          // Operator-confirmed content on the same section must survive.
          kpiForecastNote: "operator note",
        } satisfies PerformanceSectionData as unknown as Record<string, unknown>,
      },
    },
    meta: {
      status: "complete",
      specialistProgress: [],
      campaignFacts: {
        brandName: "Tafareeh Tea",
        objective: "Build awareness",
        platforms: ["instagram"],
        geography: ["Egypt"],
        durationWeeks: 2,
        extractedAt: "",
        confidence: {},
        sources: {},
      },
    },
  } as unknown as CampaignObject;
}

/** Never reached by these cases — a call would mean the test is not isolated. */
const supabase = new Proxy(
  {},
  {
    get() {
      throw new Error("browseUnifiedCreators must not run for a Discovery-only slate");
    },
  }
) as unknown as SupabaseClient;

function performanceOf(campaignObject: CampaignObject): PerformanceSectionData {
  return (campaignObject.sections.performance?.data ?? {}) as PerformanceSectionData;
}

// ---------------------------------------------------------------------------

test("a Discovery-only slate does not retain stale forecast and health", async () => {
  // Whatever the edit was — remove, add or replace — the committed slate is
  // Discovery-only, so the stored analysis describes a different creator set.
  const before = objectWith(["dp:profile-1", "dis:profile-2", "dp:profile-3"]);
  assert.ok(performanceOf(before).campaignForecast, "guard: the fixture starts stale");

  const after = await reoptimizeCampaignAfterApply(supabase, before);
  const performance = performanceOf(after);

  assert.equal(performance.campaignForecast, undefined);
  assert.equal(performance.campaignScores, undefined);
  assert.notEqual(
    performance.campaignForecast?.estimatedReach,
    STALE_FORECAST.estimatedReach
  );
  assert.notEqual(performance.campaignScores?.overall, STALE_SCORES.overall);
});

test("the slate-derived optimization and decision are dropped with them", async () => {
  const before = objectWith(["dp:profile-1"]);
  const performanceData = performanceOf(before);
  (before.sections.performance.data as Record<string, unknown>) = {
    ...performanceData,
    campaignOptimization: { stale: true },
    campaignDecision: { stale: true },
  };

  const performance = performanceOf(await reoptimizeCampaignAfterApply(supabase, before));

  assert.equal(performance.campaignOptimization, undefined);
  assert.equal(performance.campaignDecision, undefined);
});

test("clearing analysis leaves the rest of the performance section alone", async () => {
  const after = await reoptimizeCampaignAfterApply(supabase, objectWith(["dp:profile-1"]));

  assert.equal(performanceOf(after).kpiForecastNote, "operator note");
  // The slate itself is untouched — this path re-ranks nothing.
  const creators = after.sections.creators.data as CreatorsSectionData;
  assert.deepEqual(creators.recommendations?.creatorIds, ["dp:profile-1"]);
});

test("a Discovery-only slate with no stored analysis is returned unchanged", async () => {
  const before = objectWith(["dp:profile-1"]);
  (before.sections.performance.data as Record<string, unknown>) = {};

  const after = await reoptimizeCampaignAfterApply(supabase, before);

  assert.equal(after, before, "nothing to clear must not rebuild the object");
});

test("an empty slate keeps its existing early-return behaviour", async () => {
  const before = objectWith([]);

  const after = await reoptimizeCampaignAfterApply(supabase, before);

  assert.equal(after, before);
  // Deliberately unchanged: with no slate at all there is no edit to reflect.
  assert.ok(performanceOf(after).campaignForecast);
});

// E — after the slate exists, re-optimization scores against the mix the slate
// was actually composed to, not a re-derived industry default. This path has no
// workflow state, so without the persisted mix an edit would silently move the
// health score by changing the target it is measured against.

test("re-optimization uses the persisted composed mix, not the facts mix", async () => {
  const { resolveReoptimizationTierMix } = await import("./apply-draft-reoptimize");

  const facts = {
    industry: "Telecom",
    brandName: "Etisalat",
    extractedAt: "",
    confidence: {},
    sources: {},
  } as unknown as Parameters<typeof resolveReoptimizationTierMix>[0]["facts"];

  // What the slate was composed to — the approved Strategy's allocation.
  const composed = [
    { tier: "Macro", percent: 20 },
    { tier: "Micro", percent: 40 },
    { tier: "Nano", percent: 40 },
  ];

  assert.deepEqual(
    resolveReoptimizationTierMix({ composedMix: composed, strategy: undefined, facts }),
    composed,
    "the persisted mix is authoritative once a slate exists"
  );

  // Guard: the facts fallback really is different, so this is a live choice.
  const fallback = resolveReoptimizationTierMix({
    composedMix: [],
    strategy: undefined,
    facts,
  });
  assert.notDeepEqual(fallback, composed);
  assert.ok(
    fallback.some((tier) => tier.tier === "Celebrity"),
    "guard: the Telecom facts mix leads with Celebrity"
  );
});

test("with no persisted mix the existing fallback order is unchanged", async () => {
  const { resolveReoptimizationTierMix } = await import("./apply-draft-reoptimize");

  const facts = {
    industry: "Telecom",
    extractedAt: "",
    confidence: {},
    sources: {},
  } as unknown as Parameters<typeof resolveReoptimizationTierMix>[0]["facts"];
  const strategy = {
    creatorTierStrategy: [{ tier: "Mega", allocationPercent: 100, why: "" }],
  } as unknown as Parameters<typeof resolveReoptimizationTierMix>[0]["strategy"];

  // Strategy still beats facts when there is no composed mix …
  assert.deepEqual(
    resolveReoptimizationTierMix({ composedMix: [], strategy, facts }).map((t) => t.tier),
    ["Mega"]
  );
  // … and with neither, nothing is invented.
  assert.deepEqual(
    resolveReoptimizationTierMix({ composedMix: [], strategy: undefined, facts: undefined }),
    []
  );
});
