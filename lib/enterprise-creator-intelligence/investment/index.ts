export type {
  CreatorInvestmentAiHints,
  CreatorInvestmentIntelligence,
  InvestmentBusinessReadiness,
  InvestmentConfidence,
  InvestmentDimensionKey,
  InvestmentDimensionScore,
  InvestmentExplainability,
  InvestmentOpportunity,
  InvestmentRecommendation,
  InvestmentRecommendationInsight,
  InvestmentRisk,
  InvestmentRiskSeverity,
  InvestmentSource,
} from "@/lib/enterprise-creator-intelligence/investment/types";

export {
  INVESTMENT_CONSUMERS,
  INVESTMENT_DIMENSION_LABELS,
  INVESTMENT_DIMENSION_WEIGHTS,
} from "@/lib/enterprise-creator-intelligence/investment/types";

export {
  averageNullable,
  mapAudienceQuality,
  mapAudienceStability,
  mapCampaignSuccess,
  mapCommercialHealthLevel,
  mapContentConsistency,
  mapGrowthStability,
  mapInvestmentReadiness,
  mapPerformanceReliability,
  mapPublishingEffectiveness,
  mapSpecialisation,
} from "@/lib/enterprise-creator-intelligence/investment/map-score";

export {
  classifyInvestmentRecommendation,
  computeInvestmentConfidence,
  computeWeightedOverallScore,
} from "@/lib/enterprise-creator-intelligence/investment/recommend";

export {
  computeCreatorInvestmentIntelligence,
  type CreatorInvestmentFacts,
  type InvestmentLayerBundle,
} from "@/lib/enterprise-creator-intelligence/investment/compute";

export { appendInvestmentIntelligenceCapture } from "@/lib/enterprise-creator-intelligence/investment/persist";

export {
  buildInvestmentAiHints,
  loadCreatorInvestmentIntelligence,
} from "@/lib/enterprise-creator-intelligence/investment/load";
