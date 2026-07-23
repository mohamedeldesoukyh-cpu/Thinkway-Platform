export type RefreshRecommendationAction =
  | "refresh_metrics"
  | "refresh_ipl"
  | "refresh_dna"
  | "refresh_audience"
  | "refresh_avatar"
  | "refresh_ai_analysis"
  | "complete_profile";

export type RefreshRecommendation = Readonly<{
  action: RefreshRecommendationAction;
  label: string;
  priority: number;
  reasons: readonly string[];
  estimatedApifyCredits: number;
  estimatedAiUnits: number;
}>;

export type CreatorRecommendationReport = Readonly<{
  creatorId: string;
  healthScore: number;
  healthGrade: string;
  recommendations: readonly RefreshRecommendation[];
  optimizationOpportunities: readonly string[];
  generatedAt: string;
  policyVersion: string;
  autonomous: true;
}>;
