import { CAMPAIGN_PLANNING_ENGINE_VERSION } from "./config";
import { buildAudienceStrategy } from "./audience-strategy";
import { buildBudgetStrategy } from "./budget-strategy";
import { buildCreatorMixStrategy } from "./creator-mix";
import { buildDeliverableStrategy } from "./deliverable-strategy";
import { buildDiscoveryBrief } from "./discovery-mapping";
import { buildPlatformStrategy } from "./platform-strategy";
import { computeStrategyQualityScore } from "./strategy-score";
import { buildTimelineStrategy } from "./timeline-strategy";
import type { CampaignPlanningInput, CampaignStrategy } from "./types";

/**
 * Single entry point for AI campaign planning.
 * Orchestrates strategy generation from a campaign brief — does not modify Discovery or Forecast engines.
 */
export function generateCampaignStrategy(input: CampaignPlanningInput): CampaignStrategy {
  const generatedAt = new Date().toISOString();
  const brief = input.brief;

  const creatorMix = buildCreatorMixStrategy(input);
  const platformStrategy = buildPlatformStrategy(input);
  const deliverableStrategy = buildDeliverableStrategy(input, platformStrategy);
  const budgetStrategy = buildBudgetStrategy(input, creatorMix, platformStrategy, deliverableStrategy);
  const timelineStrategy = buildTimelineStrategy(input, creatorMix);
  const audienceStrategy = buildAudienceStrategy(input);
  const discoveryBrief = buildDiscoveryBrief({
    planning: input,
    creatorMix,
    platformStrategy,
    audienceStrategy,
  });
  const strategyScore = computeStrategyQualityScore({
    planning: input,
    creatorMix,
    platformStrategy,
    budgetStrategy,
    timelineStrategy,
    audienceStrategy,
  });

  const briefSummary = [
    brief.brandName,
    brief.objective,
    brief.budget?.amount ? `${brief.budget.amount.toLocaleString()} ${brief.budget.currency ?? ""}` : null,
    brief.durationWeeks ? `${brief.durationWeeks} weeks` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const assumptions = [
    brief.budget?.amount ? undefined : "Budget not provided — placeholder 100k used for allocation modeling.",
    brief.durationWeeks ? undefined : "Duration defaulted to 8 weeks for timeline waves.",
    brief.geography?.length ? undefined : "Geography open — Discovery filters may be broad.",
    "Creator counts scale from budget using optimization cost-efficiency heuristics.",
    "Forecast/Optimization/Decision principles referenced in reasoning — engines not invoked at planning time.",
  ].filter(Boolean) as string[];

  const explainability = [
    `Generated ${creatorMix.totalCreators} creators across ${creatorMix.tiers.length} tiers.`,
    `Platform strategy: ${platformStrategy.platforms.map((p) => `${p.platform} ${p.budgetPercent}%`).join(", ")}.`,
    `Deliverable mix: ${deliverableStrategy.contentMixSummary}.`,
    `Timeline: ${timelineStrategy.mode} over ${timelineStrategy.durationWeeks} weeks (${timelineStrategy.waves.length} waves).`,
    discoveryBrief.summary,
    ...strategyScore.explainability.slice(0, 3),
  ];

  return {
    engineVersion: CAMPAIGN_PLANNING_ENGINE_VERSION,
    generatedAt,
    briefSummary,
    creatorMix,
    platformStrategy,
    deliverableStrategy,
    budgetStrategy,
    timelineStrategy,
    audienceStrategy,
    discoveryBrief,
    strategyScore,
    explainability,
    assumptions,
  };
}

export function toCampaignStrategySnapshot(strategy: CampaignStrategy): CampaignStrategy {
  return strategy;
}
