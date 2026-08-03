import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyCampaignObject } from "@/features/campaign-intelligence/services/section-updaters";

import {
  buildStudioExecutivePlanningSummary,
  pickStrategyCompareFinal,
  toCampaignDecisionLabel,
  toExecutiveCreatorCardView,
} from "./executive-planning-view";
import type { StudioEciPlanningSignal } from "./project-studio-eci-signal";

function stubSignal(
  overrides?: Partial<StudioEciPlanningSignal>
): StudioEciPlanningSignal {
  return {
    influencerId: "c1",
    platform: "instagram",
    investmentScore: 82,
    recommendation: "Recommended",
    why: "Strong category fit and reliable delivery for this campaign.",
    whyNot: "Monitor fee pressure on peak weeks.",
    businessObjectiveSupport: "Supports awareness objective in beauty.",
    commercialJustification: "Healthy commercial outlook with efficient delivery.",
    commercialHealth: "Healthy",
    businessReadiness: "Recommended",
    evidence: ["Category authority", "Stable engagement"],
    topStrengths: ["Beauty specialist", "Audience quality"],
    risks: ["Pricing volatility: rates vary by campaign type"],
    alternatives: ["Keep a mid-tier alternate for the same wave"],
    expectedOutcomes: ["Lift branded reach among target audience"],
    confidencePercent: 78,
    evidenceCoveragePercent: 80,
    executiveSummary: "Recommended · Investment 82/100",
    layers: {
      investment: "Recommended · 82/100",
      commercial: "Health Healthy",
      audience: "Quality High · Evidence 80%",
      performance: "Trend stable",
      categoryBrand: "Primary Beauty · Evidence 75%",
      historical: "12 months of Historical Intelligence",
    },
    decision: {
      what: "Recommended",
      why: "Strong category fit",
      evidence: "Category authority",
      businessValue: "Supports awareness",
      alternative: "Keep a mid-tier alternate",
      whyNot: "Monitor fee pressure",
    },
    expectedCampaignContribution: "Brand-aligned reach and content",
    ...overrides,
  };
}

test("card view surfaces Recommended with executive bullets", () => {
  const view = toExecutiveCreatorCardView(stubSignal());
  assert.equal(view.decision, "Recommended");
  assert.ok(view.bullets.length >= 3);
  assert.match(view.explain.shouldDoThis, /Yes/i);
  assert.ok(["Very High", "High", "Moderate", "Low"].includes(view.strategyConfidence.level));
});

test("High Risk becomes Not Recommended", () => {
  assert.equal(toCampaignDecisionLabel("High Risk"), "Not Recommended");
  const view = toExecutiveCreatorCardView(
    stubSignal({ recommendation: "High Risk", why: "Audience mismatch for this brief." })
  );
  assert.equal(view.decision, "Not Recommended");
  assert.match(view.explain.shouldDoThis, /No/i);
});

test("executive planning summary is always producible", () => {
  const object = createEmptyCampaignObject({ id: "co_exec" });
  object.meta.campaignFacts = {
    extractedAt: new Date().toISOString(),
    confidence: {},
    sources: {},
    objective: "Drive awareness in KSA beauty",
  };
  const summary = buildStudioExecutivePlanningSummary(object, [stubSignal()]);
  assert.match(summary.campaignObjective, /awareness/i);
  assert.ok(summary.recommendedStrategy.length > 0);
  assert.ok(summary.planningConfidence.level);
  assert.ok(summary.recommendedOption.length > 0);
  assert.ok(summary.alternativeOption.length > 0);
  assert.ok(summary.decisionImpactSummary.length > 0);
  assert.ok(summary.tradeOffs.length > 0);
});

test("planning confidence floors at Moderate when slate intel exists without creatorIds", () => {
  const object = createEmptyCampaignObject({ id: "co_slate_recover" });
  object.meta.campaignFacts = {
    extractedAt: new Date().toISOString(),
    confidence: {},
    sources: {},
    objective: "F1 Abu Dhabi awareness",
  };
  object.sections.creators.data = {
    recommendations: {
      creatorIds: [],
      selectedReasoning: [],
      rejectedReasoning: [],
      avgFitScore: 72,
    },
    slateIntelligence: {
      actualMix: [],
      tierShortages: [],
      updatedAt: new Date().toISOString(),
      recommendations: Array.from({ length: 8 }, (_, i) => ({
        creatorId: `inf:${i}`,
        role: "main" as const,
        tier: "Micro",
        wave: 1,
        score: 70,
        priority: "high" as const,
        serviceType: "1× IG Reel",
        contentPillar: "Brand story",
        suggestedTimelineSlot: "Week 1",
      })),
    },
  };
  const lowSignals = [
    stubSignal({
      confidencePercent: 20,
      evidenceCoveragePercent: 15,
      recommendation: "Monitor",
    }),
  ];
  const summary = buildStudioExecutivePlanningSummary(object, lowSignals);
  assert.equal(summary.planningConfidence.level, "Moderate");
});

test("card view includes canonical recommendation narrative", () => {
  const view = toExecutiveCreatorCardView(stubSignal(), "Creator A");
  assert.ok(view.narrative);
  assert.equal(view.narrative.steps.length, 9);
  assert.ok(view.narrative.alternatives.alternatives.length >= 1);
  assert.ok(view.narrative.decisionImpactSummary.length > 0);
});

test("strategy compare picks a final recommendation", () => {
  const final = pickStrategyCompareFinal([
    { id: "a", displayName: "Creator A", signal: stubSignal({ investmentScore: 70 }) },
    {
      id: "b",
      displayName: "Creator B",
      signal: stubSignal({
        influencerId: "c2",
        investmentScore: 90,
        why: "Best commercial and audience fit for this campaign.",
      }),
    },
  ]);
  assert.equal(final.winnerName, "Creator B");
  assert.match(final.why, /Creator B/i);
});
