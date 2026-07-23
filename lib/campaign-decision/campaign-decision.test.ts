import assert from "node:assert/strict";

import { computeCampaignForecast } from "@/lib/campaign-forecast";
import { optimizeCampaign } from "@/lib/campaign-optimization";
import { evaluateCampaignDecision } from "./index";

function buildScenario() {
  const forecast = computeCampaignForecast({
    creators: [
      {
        creatorKey: "a",
        displayName: "Creator X",
        followers: 700_000,
        platform: "instagram",
        engagementRate: 2.2,
        countryCode: "EG",
        categories: ["beauty"],
        niche: "beauty",
        deliverables: [{ contentType: "instagram_reel", quantity: 2 }],
      },
      {
        creatorKey: "b",
        displayName: "Creator Y",
        followers: 550_000,
        platform: "instagram",
        engagementRate: 2.0,
        countryCode: "EG",
        categories: ["beauty"],
        niche: "beauty",
        deliverables: [{ contentType: "instagram_post", quantity: 2 }],
      },
    ],
    campaignPlatform: "instagram",
  });

  const optimization = optimizeCampaign({
    forecast,
    context: {
      budget: { amount: 400_000, currency: "EGP" },
      audienceTargets: { countryCodes: ["EG"] },
    },
  });

  return { forecast, optimization };
}

{
  const { forecast, optimization } = buildScenario();
  const report = evaluateCampaignDecision({
    forecast,
    optimization,
    configuration: {
      commercial: { budget: { amount: 400_000, currency: "EGP" }, gpHealth: "at_risk" },
      operational: {
        deliverablesDefined: false,
        unenrichedCreatorCount: 1,
      },
      kpiTargets: {
        reach: Math.round(forecast.estimatedReach * 1.05),
        engagement: Math.round(forecast.estimatedEngagements * 1.1),
      },
    },
  });

  assert.equal(report.engineVersion, "campaign_decision_v1");
  assert.ok(["ready", "ready_with_minor_risks", "needs_review", "high_risk", "not_ready"].includes(report.readiness));
  assert.ok(report.readiness !== "ready" || report.risks.length === 0);
  assert.ok(report.decisionScore.overall >= 0 && report.decisionScore.overall <= 100);
  assert.ok(report.risks.length > 0);
  assert.equal(report.riskMatrix.length, 5);
  assert.ok(report.kpiProbabilities.length >= 5);
  assert.ok(report.recommendations.length > 0);
  assert.ok(report.approvalSummary.strengths.length >= 0);
  assert.ok(report.approvalSummary.risks.length > 0);
  assert.ok(report.explainability.length >= 3);

  const overlapRisk = report.risks.find((r) => r.title.toLowerCase().includes("overlap"));
  assert.ok(overlapRisk, "should detect overlap risk");

  const reachProb = report.kpiProbabilities.find((k) => k.metric === "Reach Target");
  assert.ok(reachProb && reachProb.probability > 0 && reachProb.probability <= 100);

  console.log("✓ complete decision report");
  console.log(`  Readiness: ${report.readinessLabel} (${report.readiness})`);
  console.log(`  Decision score: ${report.decisionScore.overall}/100`);
  console.log(`  Executive recommendation: ${report.approvalSummary.recommendation.slice(0, 90)}…`);
}

{
  const { forecast, optimization } = buildScenario();
  const studioReport = evaluateCampaignDecision({ forecast, optimization });
  const exportReport = evaluateCampaignDecision({ forecast, optimization });
  assert.deepEqual(
    studioReport.approvalSummary.overallAssessment,
    exportReport.approvalSummary.overallAssessment
  );
  assert.equal(studioReport.decisionScore.overall, exportReport.decisionScore.overall);
  console.log("✓ identical decision reports across consumer paths");
}

console.log("\nAll Phase 5 campaign decision tests passed.");
