import assert from "node:assert/strict";
import test from "node:test";

import {
  assertRecommendationNarrativeComplete,
  buildRecommendationNarrative,
  INSUFFICIENT_EVIDENCE,
  RECOMMENDATION_NARRATIVE_STEPS,
} from "./recommendation-narrative";
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
    },
    expectedCampaignContribution: "Brand-aligned reach and content",
    ...overrides,
  };
}

test("narrative includes every canonical step with non-empty body", () => {
  const narrative = buildRecommendationNarrative(stubSignal(), "Creator A");
  const check = assertRecommendationNarrativeComplete(narrative);
  assert.equal(check.ok, true, check.missing.join(", "));
  assert.equal(narrative.steps.length, RECOMMENDATION_NARRATIVE_STEPS.length);
  for (const step of narrative.steps) {
    assert.ok(step.body.trim().length > 0, step.key);
  }
});

test("narrative always exposes an alternative and decision impact", () => {
  const narrative = buildRecommendationNarrative(stubSignal(), "Creator A");
  assert.ok(narrative.alternativeConsidered.trim());
  assert.ok(narrative.whyAlternativeNotSelected.trim());
  assert.ok(narrative.decisionImpactSummary.trim());
  assert.ok(narrative.alternatives.alternatives.length >= 1);
  assert.ok(narrative.alternatives.tradeOffs.trim());
  assert.ok(narrative.decisionImpact.assessments.length > 0);
});

test("weak evidence surfaces Insufficient evidence available", () => {
  const narrative = buildRecommendationNarrative(
    stubSignal({
      evidence: [],
      evidenceCoveragePercent: 10,
      confidencePercent: 10,
      commercialJustification: "",
      businessObjectiveSupport: "",
      risks: [],
      alternatives: [],
      decision: {
        what: "Recommended",
        why: "",
        evidence: "",
        businessValue: "",
        alternative: "",
      },
      why: "",
    }),
    "Creator Thin"
  );
  assert.equal(narrative.evidence, INSUFFICIENT_EVIDENCE);
  assert.equal(narrative.commercialValue, INSUFFICIENT_EVIDENCE);
  assert.equal(narrative.alternativeConsidered, INSUFFICIENT_EVIDENCE);
  assert.ok(narrative.alternatives.alternatives.length >= 1);
  assert.ok(assertRecommendationNarrativeComplete(narrative).ok);
});

test("Not Recommended still has explanation, alternative, and impact", () => {
  const narrative = buildRecommendationNarrative(
    stubSignal({
      recommendation: "High Risk",
      why: "Audience mismatch for this brief.",
      whyNot: "Audience mismatch for this brief.",
    }),
    "Creator B"
  );
  assert.equal(narrative.decision, "Not Recommended");
  assert.match(narrative.what, /Not Recommended/i);
  assert.ok(narrative.whyBest.trim());
  assert.ok(narrative.alternativeConsidered.trim());
  assert.ok(narrative.decisionImpactSummary.trim());
});
