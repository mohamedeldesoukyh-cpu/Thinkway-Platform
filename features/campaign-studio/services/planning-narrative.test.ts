import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyCampaignObject } from "@/features/campaign-intelligence/services/section-updaters";

import { buildCampaignProposalModel } from "../export/campaign-proposal-document";

import {
  PLANNING_NARRATIVE_SPINE,
  deriveEnterprisePlanningNarrative,
  formatExecutiveBriefLines,
  getCanonicalPlanningPackageFields,
} from "./planning-narrative";

test("planning narrative produces full spine with assumptions and open decisions", () => {
  const object = createEmptyCampaignObject({ id: "co_pkg" });
  object.meta.campaignFacts = {
    extractedAt: new Date().toISOString(),
    confidence: {},
    sources: {},
    objective: "Drive awareness in KSA beauty",
    audience: "Women 18–34",
    platforms: ["instagram", "tiktok"],
    budget: { amount: 100000, currency: "USD" },
    kpis: ["Reach", "Engagement"],
    geography: ["KSA"],
    rawBriefExcerpt:
      "Launch a beauty awareness campaign for the brand in KSA with measurable reach and engagement among women 18-34.",
  };

  const narrative = deriveEnterprisePlanningNarrative(object);
  assert.equal(narrative.spine.length, PLANNING_NARRATIVE_SPINE.length);
  assert.ok(narrative.assumptions.length >= 4);
  assert.ok(narrative.openDecisions.length >= 2);
  assert.ok(narrative.strategyPillars.length === 11);
  assert.ok(narrative.executiveRecommendation.includes("What we should do"));
  assert.ok(narrative.briefCompleteness.scorePercent > 0);
  assert.ok(narrative.packageOpening.length > 40);
  assert.ok(narrative.presentationBeats.some((b) => b.label === "Approval Request"));
  assert.match(narrative.approvalJourney.headline, /Campaign Workspace/i);
  assert.ok(narrative.executiveObjections.length >= 8);
  assert.ok(narrative.executiveObjections.some((o) => /Budget pressure/i.test(o.concern)));
  assert.ok(
    narrative.executiveObjections.every(
      (o) => o.observation.trim().length > 20 && !/blocker|blocked|cannot proceed/i.test(o.observation)
    )
  );
  assert.ok(narrative.criticalSuccessFactors.length >= 5);
  assert.match(
    narrative.executiveDecisionSummary.decisionRequested,
    /Approve this Enterprise Planning Package/i
  );
  assert.ok(narrative.executiveDecisionSummary.immediateNextSteps.length >= 3);

  const lines = formatExecutiveBriefLines(narrative);
  assert.equal(lines.length, 7);
  assert.equal(lines[0]?.label, "Objective");
});

test("brief completeness highlights missing planning information", () => {
  const object = createEmptyCampaignObject({ id: "co_thin" });
  const narrative = deriveEnterprisePlanningNarrative(object);
  assert.ok(narrative.briefCompleteness.missingLabels.length > 0);
  assert.match(narrative.briefCompleteness.summary, /Missing planning information/i);
});

test("proposal model copies Planning Narrative without parallel executive wording", () => {
  const object = createEmptyCampaignObject({ id: "co_sync" });
  object.meta.campaignFacts = {
    extractedAt: new Date().toISOString(),
    confidence: {},
    sources: {},
    objective: "Drive awareness in KSA beauty",
    audience: "Women 18–34",
    platforms: ["instagram"],
    budget: { amount: 80000, currency: "USD" },
    kpis: ["Reach"],
    geography: ["KSA"],
    rawBriefExcerpt:
      "Beauty awareness campaign for KSA with measurable reach among women 18-34 across Instagram.",
  };
  object.sections.presentation.data = {
    executiveSummary: {
      summary: "PARALLEL SUMMARY THAT MUST NOT APPEAR",
      keyDecisions: [],
      recommendedActions: ["Parallel action that must not appear"],
      immediateNextSteps: [],
      expectedBusinessOutcome: "",
      grounding: { source: "AI", confidence: 50, reason: "test" },
    },
  };

  const narrative = deriveEnterprisePlanningNarrative(object);
  const canonical = getCanonicalPlanningPackageFields(narrative);
  const model = buildCampaignProposalModel(object);

  assert.equal(model.executiveRecommendation, narrative.executiveRecommendation);
  assert.equal(model.executiveSummary, narrative.executiveRecommendation);
  assert.equal(model.packageOpening, narrative.executiveRecommendation);
  assert.equal(model.strategyText, narrative.campaignStrategy);
  assert.equal(model.businessChallenge, canonical.businessChallenge);
  assert.equal(model.strategicInsight, canonical.strategicInsight);
  assert.equal(model.recommendedBusinessDecision, canonical.recommendedBusinessDecision);
  assert.equal(model.commercialStrategy, narrative.commercialStrategy);
  assert.equal(model.executionStrategy, narrative.executionStrategy);
  assert.equal(model.expectedBusinessOutcome, canonical.expectedBusinessOutcome);
  assert.equal(
    model.approvalAsk,
    narrative.executiveDecisionSummary.decisionRequested
  );
  assert.deepEqual(
    model.recommendedActions,
    narrative.executiveDecisionSummary.immediateNextSteps
  );
  assert.ok(!model.executiveSummary.includes("PARALLEL SUMMARY"));
  assert.ok(!model.recommendedActions.some((a) => /Parallel action/i.test(a)));
  assert.equal(model.canonicalFields.executiveRecommendation, narrative.executiveRecommendation);
});
