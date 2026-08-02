export type {
  AnalysisWindowKey,
  AudienceResponseInsight,
  AudienceResponseKey,
  CampaignPerformanceInsight,
  CreatorPerformanceAiHints,
  CreatorPerformanceIntelligence,
  ForecastReadiness,
  PerformanceConfidence,
  PerformanceExplainability,
  PerformanceMetricKey,
  PerformanceMetricSnapshot,
  PerformancePlanningReadiness,
  PerformanceReliabilityInsight,
  PerformanceReliabilityLevel,
  PerformanceSource,
  PerformanceStabilityInsight,
  PerformanceStabilityLevel,
  PerformanceTrendLabel,
  PublishingEffectivenessInsight,
  PublishingEffectivenessLevel,
  WindowPerformanceBundle,
} from "@/lib/enterprise-creator-intelligence/performance/types";

export {
  PERFORMANCE_CONSUMERS,
  PERFORMANCE_WINDOWS,
} from "@/lib/enterprise-creator-intelligence/performance/types";

export {
  classifyPerformanceTrend,
  classifyPublishingEffectiveness,
  classifyReliability,
  classifyStability,
  detectSeasonality,
} from "@/lib/enterprise-creator-intelligence/performance/trends";

export {
  computeCreatorPerformanceIntelligence,
  type CreatorPerformanceFacts,
  type PerformancePublicationFact,
} from "@/lib/enterprise-creator-intelligence/performance/compute";

export { loadCreatorPerformanceFacts } from "@/lib/enterprise-creator-intelligence/performance/load-facts";

export { appendPerformanceIntelligenceCapture } from "@/lib/enterprise-creator-intelligence/performance/persist";

export {
  buildPerformanceAiHints,
  loadCreatorPerformanceIntelligence,
} from "@/lib/enterprise-creator-intelligence/performance/load";
