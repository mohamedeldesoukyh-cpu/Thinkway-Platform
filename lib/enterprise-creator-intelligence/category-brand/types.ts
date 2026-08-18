/**
 * Enterprise Creator Intelligence — Category & Brand (Sprint 3)
 * Behavioural content intelligence for Planning / Client / AI / Reporting / Mobile.
 */

import type { EvidenceCoverage } from "@/lib/enterprise-creator-intelligence/shared/types";

export type AnalysisWindowKey =
  | "last_30_days"
  | "last_90_days"
  | "last_180_days"
  | "lifetime";

export type CategoryTrendLabel =
  | "Increasing"
  | "Stable"
  | "Declining"
  | "Emerging"
  | "Unknown";

export type ContentMixType =
  | "Reels"
  | "Stories"
  | "Carousel"
  | "Images"
  | "Video"
  | "Short Form"
  | "Long Form"
  | "Other";

export type BrandCollaborationKind = "Sponsored" | "Organic" | "Unknown";

export type BrandAffinityKind =
  | "Repeated Collaborations"
  | "One-off Collaborations"
  | "Long-term Partnerships"
  | "Recent Partnerships"
  | "Dormant Partnerships";

export type ContentConsistencyLevel =
  | "Highly Consistent"
  | "Generally Consistent"
  | "Mixed"
  | "Frequently Changing"
  | "Highly Volatile";

export type SpecialisationLevel =
  | "Highly Specialised"
  | "Balanced"
  | "Generalist"
  | "Multi-category"
  | "Emerging Category Shift";

export type CategoryBrandSource = {
  platform: string | null;
  contentSource: string;
  analysisMethod: string;
  collectionWindow: AnalysisWindowKey | "multi_window";
  confidence: number | null;
  lastRefresh: string | null;
};

export type CategoryBrandConfidence = {
  percent: number | null;
  reason: string;
  basedOn: Array<{ label: string; value: string | number }>;
};

export type CategoryBrandExplainability = {
  value: string | number | null;
  meaning: string;
  confidence: number | null;
  evidence: string[];
  historicalTrend: string;
  businessContext: string;
  dataSource: CategoryBrandSource;
  lastUpdated: string | null;
  missingInputs: string[];
};

export type CategoryShare = {
  category: string;
  percent: number;
  postCount: number;
  confidence: CategoryBrandConfidence;
  trend: CategoryTrendLabel;
  whatChanged: string;
  whyChanged: string;
  historicalTrend: string;
  businessImplication: string;
  explainability: CategoryBrandExplainability;
  source: CategoryBrandSource;
};

export type ContentMixShare = {
  contentType: ContentMixType;
  percent: number;
  postCount: number;
  confidence: CategoryBrandConfidence;
  explainability: CategoryBrandExplainability;
  source: CategoryBrandSource;
};

export type BrandCollaboration = {
  brandName: string;
  /** Instagram/TikTok mention handle used to extract this brand. Display-only. */
  handle?: string;
  industry: string | null;
  collaborationKind: BrandCollaborationKind;
  mentionCount: number;
  collaborationFrequency: number;
  lastCollaboration: string | null;
  campaignType: string | null;
  windows: Record<AnalysisWindowKey, number>;
  affinity: BrandAffinityKind[];
  confidence: CategoryBrandConfidence;
  explainability: CategoryBrandExplainability;
  source: CategoryBrandSource;
  /** Sentiment extension point — not calculated in Sprint 3. */
  sentimentExtension: {
    available: false;
    note: string;
  };
};

export type IndustryShare = {
  industry: string;
  percent: number;
  mentionOrPostCount: number;
  trend: CategoryTrendLabel;
  confidence: CategoryBrandConfidence;
  explainability: CategoryBrandExplainability;
  source: CategoryBrandSource;
};

export type BrandAffinitySummary = {
  repeatedCollaborations: number;
  oneOffCollaborations: number;
  longTermPartnerships: number;
  recentPartnerships: number;
  dormantPartnerships: number;
  brands: BrandCollaboration[];
  explainability: CategoryBrandExplainability;
};

export type ContentConsistencyInsight = {
  level: ContentConsistencyLevel;
  meaning: string;
  confidence: CategoryBrandConfidence;
  explainability: CategoryBrandExplainability;
};

export type SpecialisationInsight = {
  level: SpecialisationLevel;
  meaning: string;
  why: string;
  confidence: CategoryBrandConfidence;
  explainability: CategoryBrandExplainability;
};

export type CategoryBrandBusinessReadiness = {
  primaryCategories: string[];
  secondaryCategories: string[];
  emergingCategories: string[];
  commercialIndustries: string[];
  brandAffinity: BrandAffinitySummary;
  specialisation: SpecialisationInsight;
  contentConsistency: ContentConsistencyInsight;
  categoryConfidence: number | null;
};

export type WindowCategoryBundle = {
  window: AnalysisWindowKey;
  analysedPostCount: number;
  categories: CategoryShare[];
  /** Always sums to 100 when categories.length > 0. */
  totalPercent: number;
  contentMix: ContentMixShare[];
  industries: IndustryShare[];
  missingInputs: string[];
};

export type CreatorCategoryBrandAiHints = {
  available: boolean;
  primaryCategory: string | null;
  emergingCategories: string[];
  specialisation: SpecialisationLevel | null;
  contentConsistency: ContentConsistencyLevel | null;
  brandCount: number;
  recommendRefresh: boolean;
};

export type CreatorCategoryBrandIntelligence = {
  influencerId: string;
  platform: string | null;
  computedAt: string;
  windows: Record<AnalysisWindowKey, WindowCategoryBundle>;
  brands: BrandCollaboration[];
  brandAffinity: BrandAffinitySummary;
  contentConsistency: ContentConsistencyInsight;
  specialisation: SpecialisationInsight;
  businessReadiness: CategoryBrandBusinessReadiness;
  /** Completeness of category/brand information — not Confidence. */
  evidenceCoverage: EvidenceCoverage;
  source: CategoryBrandSource;
  aiHints: CreatorCategoryBrandAiHints;
  consumers: readonly string[];
};

export type CategoryBrandHistoryCapture = {
  id: string;
  influencerId: string;
  platform: string | null;
  capturedAt: string;
  intelligence: CreatorCategoryBrandIntelligence;
};

export const CATEGORY_BRAND_CONSUMERS = [
  "Planning Workspace",
  "Client Workspace",
  "AI Copilot",
  "Reporting",
  "Mobile",
] as const;

export const ANALYSIS_WINDOWS: AnalysisWindowKey[] = [
  "last_30_days",
  "last_90_days",
  "last_180_days",
  "lifetime",
];
