import assert from "node:assert/strict";

import { discoveryBriefToCreatorFilterSummary, generateCampaignStrategy } from "./index";
import { strategyToDiscoveryFilters } from "@/features/campaign-studio/services/campaign-planning-service";

{
  const strategy = generateCampaignStrategy({
    brief: {
      objective: "Brand awareness launch",
      brandName: "Glow Beauty",
      industry: "beauty",
      budget: { amount: 350_000, currency: "EGP" },
      durationWeeks: 6,
      geography: ["Egypt", "EG"],
      audience: "Women 18-34 interested in skincare",
      platforms: ["instagram", "tiktok"],
      kpis: ["Reach", "Engagement Rate"],
    },
  });

  assert.equal(strategy.engineVersion, "campaign_planning_v1");
  assert.ok(strategy.creatorMix.totalCreators >= 4);
  assert.ok(strategy.creatorMix.tiers.length >= 2);
  assert.ok(strategy.platformStrategy.platforms.length >= 2);
  assert.ok(strategy.deliverableStrategy.mix.length >= 2);
  assert.ok(strategy.budgetStrategy.totalBudget === 350_000);
  assert.ok(strategy.timelineStrategy.waves.length >= 2);
  assert.ok(strategy.discoveryBrief.mappedFilters.length > 0);
  assert.ok(strategy.strategyScore.overall > 0);

  const filters = strategyToDiscoveryFilters(strategy);
  assert.ok(filters.platforms?.length || filters.platform);

  const mappingLines = discoveryBriefToCreatorFilterSummary(strategy.discoveryBrief);
  assert.ok(mappingLines.length > 0);

  console.log("✓ complete campaign strategy generated");
  console.log(`  Creators: ${strategy.creatorMix.totalCreators} (${strategy.creatorMix.tiers.map((t) => `${t.count} ${t.tier}`).join(", ")})`);
  console.log(`  Strategy score: ${strategy.strategyScore.overall}/100 (${strategy.strategyScore.label})`);
  console.log(`  Discovery filters: ${strategy.discoveryBrief.mappedFilters.length}`);
  console.log(`  Timeline: ${strategy.timelineStrategy.mode}, ${strategy.timelineStrategy.waves.length} waves`);
}

{
  const a = generateCampaignStrategy({
    brief: { objective: "Engagement", budget: { amount: 200_000 }, durationWeeks: 8, geography: ["UAE"] },
  });
  const b = generateCampaignStrategy({
    brief: { objective: "Engagement", budget: { amount: 200_000 }, durationWeeks: 8, geography: ["UAE"] },
  });
  assert.equal(a.creatorMix.totalCreators, b.creatorMix.totalCreators);
  assert.equal(a.strategyScore.overall, b.strategyScore.overall);
  console.log("✓ deterministic strategy generation");
}

console.log("\nAll Phase 6 campaign planning tests passed.");
