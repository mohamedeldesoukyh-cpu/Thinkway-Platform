import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDecisionImpactBundle,
  formatDecisionImpactSummary,
} from "./decision-impact";
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
    topStrengths: ["Beauty specialist"],
    risks: ["Pricing volatility: rates vary by campaign type"],
    alternatives: ["Keep a mid-tier alternate for the same wave"],
    expectedOutcomes: ["Lift branded reach among target audience"],
    confidencePercent: 78,
    evidenceCoveragePercent: 80,
    executiveSummary: "Recommended",
    layers: {
      investment: "Recommended",
      commercial: "Health Healthy",
      audience: "Quality High",
      performance: "Trend stable",
      categoryBrand: "Primary Beauty",
      historical: "12 months",
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

test("Decision Impact explains change scenarios when evidence is sufficient", () => {
  const bundle = buildDecisionImpactBundle(stubSignal());
  assert.equal(bundle.question, "What happens if this decision changes?");
  assert.ok(bundle.assessments.length >= 9);
  assert.ok(bundle.assessments.every((a) => a.evidenceSufficient));
  const remove = bundle.assessments.find((a) => a.change === "remove_creator");
  assert.ok(remove);
  assert.match(remove!.businessImpact, /weakens|business/i);
  assert.doesNotMatch(remove!.businessImpact, /%\s*$/);
  assert.doesNotMatch(remove!.commercialImpact, /\d+\.\d+% ROI/i);
});

test("Decision Impact refuses to estimate when evidence is insufficient", () => {
  const bundle = buildDecisionImpactBundle(
    stubSignal({
      evidence: [],
      evidenceCoveragePercent: 20,
      confidencePercent: 10,
      why: "",
      commercialJustification: "",
    })
  );
  assert.ok(bundle.assessments.every((a) => !a.evidenceSufficient));
  assert.match(
    bundle.assessments[0]!.businessImpact,
    /Insufficient historical evidence to confidently estimate impact/i
  );
  assert.match(
    formatDecisionImpactSummary(
      stubSignal({
        evidence: [],
        evidenceCoveragePercent: 10,
        confidencePercent: 10,
        why: "",
        commercialJustification: "",
      })
    ),
    /Insufficient historical evidence/i
  );
});
