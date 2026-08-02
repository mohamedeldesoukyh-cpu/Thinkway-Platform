export type {
  AnalysisWindowKey,
  AudienceBusinessReadiness,
  AudienceConfidence,
  AudienceDemographicsBundle,
  AudienceEngagementBehaviour,
  AudienceExplainability,
  AudienceGeographyInsight,
  AudienceGrowthInsight,
  AudienceGrowthTrend,
  AudienceLanguageInsight,
  AudienceLanguageRole,
  AudienceQualityInsight,
  AudienceQualityLevel,
  AudienceSource,
  AudienceStabilityInsight,
  AudienceStabilityLevel,
  CreatorAudienceAiHints,
  CreatorAudienceIntelligence,
  DistributionSlice,
  WindowAudienceBundle,
} from "@/lib/enterprise-creator-intelligence/audience/types";

export {
  AUDIENCE_CONSUMERS,
  AUDIENCE_WINDOWS,
} from "@/lib/enterprise-creator-intelligence/audience/types";

export {
  classifyAudienceQuality,
  classifyAudienceStability,
  classifyGrowthTrend,
  detectSpikesAndDrops,
} from "@/lib/enterprise-creator-intelligence/audience/classify";

export {
  computeCreatorAudienceIntelligence,
  type AudienceDemographicFact,
  type AudienceEngagementFact,
  type CreatorAudienceFacts,
} from "@/lib/enterprise-creator-intelligence/audience/compute";

export { loadCreatorAudienceFacts } from "@/lib/enterprise-creator-intelligence/audience/load-facts";

export { appendAudienceIntelligenceCapture } from "@/lib/enterprise-creator-intelligence/audience/persist";

export {
  buildAudienceAiHints,
  loadCreatorAudienceIntelligence,
} from "@/lib/enterprise-creator-intelligence/audience/load";
