import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { CampaignScoreSet } from "@/features/campaign-intelligence/types/section-schemas";
import type { CampaignForecast } from "@/lib/campaign-forecast";
import type { CampaignOptimizationReport } from "@/lib/campaign-optimization";
import type {
  CampaignConfiguration,
  CommercialIntelligenceSnapshot,
  OperationalIntelligenceSnapshot,
} from "@/lib/campaign-decision";

export function buildStudioCampaignConfiguration(input: {
  facts?: CampaignFacts;
  scores?: CampaignScoreSet;
  unenrichedCreatorCount?: number;
  planMandatoryMissing?: string[];
  operationalMandatoryMissing?: string[];
  planReadinessStatus?: "not_ready" | "ready_for_review" | null;
  operationalReadinessStatus?: "operational_ready" | "needs_attention" | null;
}): CampaignConfiguration {
  const commercial: CommercialIntelligenceSnapshot = {
    budget: input.facts?.budget,
    budgetAllocated: Boolean(input.facts?.budget?.amount),
  };

  const operational: OperationalIntelligenceSnapshot = {
    planReadinessStatus: input.planReadinessStatus ?? null,
    planMandatoryMissing: input.planMandatoryMissing ?? [],
    operationalReadinessStatus: input.operationalReadinessStatus ?? null,
    operationalMandatoryMissing: input.operationalMandatoryMissing ?? [],
    creatorSlateComplete: (input.scores?.contentCoverage ?? 0) >= 50,
    deliverablesDefined: Boolean(input.facts?.deliverables?.length),
    timelineDefined: Boolean(input.facts?.durationWeeks),
    unenrichedCreatorCount: input.unenrichedCreatorCount ?? 0,
  };

  return {
    campaignName: input.facts?.brandName ?? null,
    objective: input.facts?.objective ?? null,
    platforms: input.facts?.platforms ?? [],
    kpiTargets: {
      reach: null,
      engagement: null,
      engagementRate: null,
    },
    commercial,
    operational,
  };
}

export function buildKpiTargetsFromForecast(forecast: CampaignForecast): CampaignConfiguration["kpiTargets"] {
  return {
    reach: Math.round(forecast.estimatedReach * 0.95),
    engagement: Math.round(forecast.estimatedEngagements * 0.9),
    engagementRate: forecast.averageEngagementRate,
    impressions: Math.round(forecast.estimatedImpressions * 0.9),
    views: Math.round(forecast.estimatedViews * 0.9),
  };
}
