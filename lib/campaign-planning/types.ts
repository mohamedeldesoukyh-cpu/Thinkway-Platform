import type { CreatorMixTier } from "@/features/campaign-intelligence/types/section-schemas";
import type { DiscoveryMappedFilter } from "@/features/campaign-intelligence-profile/services/discovery-search-mapping/types";

import type { CAMPAIGN_PLANNING_ENGINE_VERSION } from "./config";

export type CampaignPlanningBrief = {
  objective?: string | null;
  industry?: string | null;
  brandName?: string | null;
  campaignType?: string | null;
  budget?: { amount: number; currency?: string | null };
  durationWeeks?: number | null;
  geography?: string[];
  audience?: string | null;
  platforms?: string[];
  deliverables?: string[];
  constraints?: string[];
  kpis?: string[];
};

export type CampaignPlanningInput = {
  brief: CampaignPlanningBrief;
};

export type StrategyRecommendation = {
  label: string;
  value: string | number;
  reasoning: string[];
  influencedBy: string[];
  constraintsApplied: string[];
  principlesUsed: string[];
};

export type CreatorMixStrategy = {
  totalCreators: number;
  tiers: CreatorMixTier[];
  recommendations: StrategyRecommendation[];
};

export type PlatformAllocation = {
  platform: string;
  budgetPercent: number;
  creatorPercent: number;
  reasoning: string[];
};

export type PlatformStrategy = {
  primaryPlatform: string;
  platforms: PlatformAllocation[];
  recommendations: StrategyRecommendation[];
};

export type DeliverableAllocation = {
  contentType: string;
  platform: string;
  quantity: number;
  sequenceOrder: number;
  reasoning: string[];
};

export type DeliverableStrategy = {
  mix: DeliverableAllocation[];
  contentMixSummary: string;
  recommendations: StrategyRecommendation[];
};

export type BudgetAllocationLine = {
  category: string;
  amount: number;
  percent: number;
  expectedImpact: string;
  reasoning: string[];
};

export type BudgetStrategy = {
  totalBudget: number;
  currency: string;
  creatorTierAllocations: BudgetAllocationLine[];
  platformAllocations: BudgetAllocationLine[];
  deliverableAllocations: BudgetAllocationLine[];
  productionAndContingency: BudgetAllocationLine[];
  expectedRoiNarrative: string;
  recommendations: StrategyRecommendation[];
};

export type TimelineWave = {
  wave: number;
  weekStart: number;
  weekEnd: number;
  focus: string;
  cadence: string;
  creatorTiers: string[];
  reasoning: string[];
};

export type TimelineStrategy = {
  durationWeeks: number;
  mode: "burst" | "always_on" | "hybrid";
  waves: TimelineWave[];
  postingCadence: string;
  peakWindows: string[];
  recommendations: StrategyRecommendation[];
};

export type AudienceSegment = {
  label: string;
  geography?: string[];
  language?: string[];
  gender?: string | null;
  ageRange?: string | null;
  interests?: string[];
  percent: number;
  reasoning: string[];
};

export type AudienceStrategy = {
  segments: AudienceSegment[];
  gaps: string[];
  recommendations: StrategyRecommendation[];
};

export type DiscoveryBrief = {
  mappedFilters: DiscoveryMappedFilter[];
  tierMix: Array<{ tier: string; percent: number }>;
  engagementThresholdMin: number | null;
  summary: string;
  skippedFields: string[];
};

export type StrategyScoreDeduction = {
  factor: string;
  points: number;
  reason: string;
};

export type StrategyQualityScore = {
  overall: number;
  label: "excellent" | "good" | "fair" | "needs_work";
  dimensions: Array<{
    key: keyof typeof import("./config").STRATEGY_SCORE_WEIGHTS;
    label: string;
    score: number;
    weight: number;
    weightedContribution: number;
    deductions: StrategyScoreDeduction[];
  }>;
  recommendations: string[];
  explainability: string[];
};

/** Complete AI-generated campaign strategy — editable before Discovery. */
export type CampaignStrategy = Readonly<{
  engineVersion: typeof CAMPAIGN_PLANNING_ENGINE_VERSION;
  generatedAt: string;
  briefSummary: string;
  creatorMix: CreatorMixStrategy;
  platformStrategy: PlatformStrategy;
  deliverableStrategy: DeliverableStrategy;
  budgetStrategy: BudgetStrategy;
  timelineStrategy: TimelineStrategy;
  audienceStrategy: AudienceStrategy;
  discoveryBrief: DiscoveryBrief;
  strategyScore: StrategyQualityScore;
  explainability: string[];
  assumptions: string[];
}>;

export type CampaignStrategySnapshot = CampaignStrategy;
