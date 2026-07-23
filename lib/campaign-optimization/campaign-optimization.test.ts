import assert from "node:assert/strict";

import { computeCampaignForecast } from "@/lib/campaign-forecast";
import { optimizeCampaign } from "./index";

function buildOverlapHeavyForecast() {
  return computeCampaignForecast({
    creators: [
      {
        creatorKey: "macro-1",
        displayName: "Creator X",
        handle: "@creatorx",
        followers: 800_000,
        platform: "instagram",
        engagementRate: 2.1,
        countryCode: "EG",
        categories: ["beauty"],
        niche: "beauty",
        deliverables: [{ contentType: "instagram_reel", quantity: 2 }],
      },
      {
        creatorKey: "macro-2",
        displayName: "Creator Y",
        handle: "@creatory",
        followers: 600_000,
        platform: "instagram",
        engagementRate: 2.4,
        countryCode: "EG",
        categories: ["beauty"],
        niche: "beauty",
        deliverables: [{ contentType: "instagram_reel", quantity: 1 }],
      },
      {
        creatorKey: "macro-3",
        followers: 500_000,
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
}

{
  const forecast = buildOverlapHeavyForecast();
  const report = optimizeCampaign({
    forecast,
    context: {
      budget: { amount: 250_000, currency: "EGP" },
      campaignPlatform: "instagram",
      audienceTargets: { countryCodes: ["EG"] },
      tierMix: [
        { tier: "Micro", percent: 40 },
        { tier: "Mid", percent: 35 },
        { tier: "Macro", percent: 25 },
      ],
    },
  });

  assert.equal(report.engineVersion, "campaign_optimization_v1");
  assert.ok(report.healthScore.overall >= 0 && report.healthScore.overall <= 100);
  assert.equal(report.healthScore.dimensions.length, 6);
  assert.ok(report.opportunities.length > 0);
  assert.ok(report.recommendations.length > 0);
  assert.equal(report.scenarioComparisons.length, 5);
  assert.ok(report.scenarioComparisons[0]!.scenario === "current");
  assert.ok(
    report.scenarioComparisons.find((s) => s.scenario === "reach_optimized")!.deltaFromCurrent
      .estimatedReachPct >= 0
  );

  const highImpact = report.opportunities.filter((o) => o.impact === "high");
  assert.ok(highImpact.length >= 1, "overlap-heavy roster should surface high-impact reach opportunity");

  const overlapOpp = report.opportunities.find((o) =>
    o.title.toLowerCase().includes("overlap")
  );
  assert.ok(overlapOpp, "should detect audience overlap opportunity");
  assert.ok(overlapOpp!.expectedReachGainPct != null && overlapOpp!.expectedReachGainPct > 0);

  const recommendation = report.recommendations.find((r) => r.opportunityId === overlapOpp!.id);
  assert.ok(recommendation, "every high-impact opportunity should have a recommendation");
  assert.ok(recommendation!.action.length > 20, "recommendations must be actionable, not generic");
  assert.ok(recommendation!.reasoning.length > 0);
  assert.ok(recommendation!.triggeredMetrics.includes("overlapDeduction"));

  console.log("✓ campaign health, opportunities, recommendations, scenarios");
  console.log(`  Health: ${report.healthScore.overall}/100 (${report.healthScore.label})`);
  console.log(`  Top recommendation: ${recommendation!.action.slice(0, 80)}…`);
}

{
  const forecast = computeCampaignForecast({
    creators: [
      {
        creatorKey: "solo",
        followers: 50_000,
        platform: "tiktok",
        engagementRate: 6.2,
        deliverables: [{ contentType: "tiktok_video", quantity: 2 }],
      },
    ],
  });

  const report = optimizeCampaign({ forecast });
  assert.ok(report.healthScore.overall > 0);
  assert.ok(report.diagnostics.limitedAudienceSignals);
  assert.ok(report.explainability.length >= 3);
  console.log("✓ single-creator campaign optimization with limited audience signals");
}

{
  const forecast = buildOverlapHeavyForecast();
  const report = optimizeCampaign({ forecast, context: { budget: { amount: 500_000 } } });
  const current = report.scenarioComparisons.find((s) => s.scenario === "current")!;
  const reachOpt = report.scenarioComparisons.find((s) => s.scenario === "reach_optimized")!;
  const engagementOpt = report.scenarioComparisons.find(
    (s) => s.scenario === "engagement_optimized"
  )!;
  const budgetOpt = report.scenarioComparisons.find((s) => s.scenario === "budget_optimized")!;

  assert.ok(reachOpt.kpis.estimatedReach >= current.kpis.estimatedReach);
  assert.ok(engagementOpt.kpis.estimatedEngagements >= current.kpis.estimatedEngagements);
  assert.ok(budgetOpt.kpis.estimatedViews >= current.kpis.estimatedViews);
  console.log("✓ scenario comparison deltas vs current campaign");
}

console.log("\nAll Phase 4 campaign optimization tests passed.");
