import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { CampaignStrategyDocument, SpecialistOutput } from "@/features/campaign-director/types";
import type { DebateResult } from "@/features/campaign-director/debate";
import type { GroundedCreator } from "@/features/ai-workflows/formatters/creator-formatter";

import { buildBudgetPlannerReasoning } from "./budget-planner-reasoning";
import { buildCreatorActivationTimeline } from "./creator-activation-timeline";
import { buildCreatorMixReasoning } from "./creator-mix-reasoning";
import { buildDirectorDecisionMinutes } from "./director-decision-minutes";
import { buildExecutiveStrategyReasoning } from "./executive-strategy-reasoning";
import { buildIndustryBenchmarkIntelligence } from "./industry-benchmark-reasoning";
import { buildKpiForecastReasoning } from "./kpi-reasoning";
import { buildObjectiveAchievementAssessment } from "./objective-achievement-assessment";
import { buildVendorDiscoveryFunnel } from "./vendor-discovery-funnel";
import { buildVendorRecommendationReasoning } from "./vendor-recommendation-reasoning";

export type Is1ReasoningBundle = {
  executiveStrategy: ReturnType<typeof buildExecutiveStrategyReasoning>;
  vendorDiscoveryFunnel: ReturnType<typeof buildVendorDiscoveryFunnel>;
  vendorRecommendations: ReturnType<typeof buildVendorRecommendationReasoning>;
  budgetPlanner: ReturnType<typeof buildBudgetPlannerReasoning>;
  creatorActivationTimeline: ReturnType<typeof buildCreatorActivationTimeline>;
  creatorMix: ReturnType<typeof buildCreatorMixReasoning>;
  kpiForecast: ReturnType<typeof buildKpiForecastReasoning>;
  directorDecisionMinutes: ReturnType<typeof buildDirectorDecisionMinutes>;
  industryBenchmark: ReturnType<typeof buildIndustryBenchmarkIntelligence>;
  objectiveAchievement: ReturnType<typeof buildObjectiveAchievementAssessment>;
};

export function buildIs1ReasoningBundle(
  facts: CampaignFacts,
  strategy: CampaignStrategyDocument,
  options?: {
    briefText?: string;
    specialistOutputs?: SpecialistOutput[];
    selectedCreators?: GroundedCreator[];
    poolCreators?: GroundedCreator[];
    finalCandidateCount?: number;
    isSearching?: boolean;
    debateResult?: DebateResult;
  }
): Is1ReasoningBundle {
  const finalCount = options?.finalCandidateCount ?? options?.selectedCreators?.length ?? 0;
  const briefText = options?.briefText ?? facts.rawBriefExcerpt ?? strategy.narrative;
  const debateResult = options?.debateResult;

  return {
    executiveStrategy: buildExecutiveStrategyReasoning(facts, strategy, debateResult),
    vendorDiscoveryFunnel: buildVendorDiscoveryFunnel(
      facts,
      strategy,
      finalCount,
      options?.isSearching ?? false
    ),
    vendorRecommendations: buildVendorRecommendationReasoning(
      facts,
      strategy,
      options?.selectedCreators ?? [],
      options?.poolCreators ?? [],
      debateResult
    ),
    budgetPlanner: buildBudgetPlannerReasoning(facts, strategy, briefText, debateResult),
    creatorActivationTimeline: buildCreatorActivationTimeline(facts, strategy, debateResult),
    creatorMix: buildCreatorMixReasoning(facts, strategy, debateResult),
    kpiForecast: buildKpiForecastReasoning(facts, strategy, debateResult),
    directorDecisionMinutes: buildDirectorDecisionMinutes(
      facts,
      strategy,
      options?.specialistOutputs ?? [],
      debateResult
    ),
    industryBenchmark: buildIndustryBenchmarkIntelligence(facts, strategy, debateResult),
    objectiveAchievement: buildObjectiveAchievementAssessment(facts, strategy, debateResult),
  };
}

export {
  buildExecutiveStrategyReasoning,
  buildVendorDiscoveryFunnel,
  buildVendorRecommendationReasoning,
  buildBudgetPlannerReasoning,
  buildCreatorActivationTimeline,
  buildCreatorMixReasoning,
  buildKpiForecastReasoning,
  buildDirectorDecisionMinutes,
  buildIndustryBenchmarkIntelligence,
  buildObjectiveAchievementAssessment,
};

export type { ExecutiveStrategyReasoning } from "./executive-strategy-reasoning";
export type { VendorDiscoveryFunnelStage } from "./vendor-discovery-funnel";
export type {
  VendorRecommendationReasoning,
  VendorSelectedReasoning,
  VendorRejectedReasoning,
} from "./vendor-recommendation-reasoning";
export type { BudgetAllocationReasoning, BudgetPlannerReasoning } from "./budget-planner-reasoning";
export type { CreatorActivationWeek, CreatorActivationTimeline } from "./creator-activation-timeline";
export type { CreatorMixReasoning, CreatorMixReasoningTier } from "./creator-mix-reasoning";
export type { KpiReasoningEntry, KpiForecastReasoning } from "./kpi-reasoning";
export type { DirectorDecisionMinute } from "./director-decision-minutes";
export type { IndustryBenchmarkData, ObjectiveAchievementEntry } from "@/features/campaign-intelligence/types/section-schemas";
