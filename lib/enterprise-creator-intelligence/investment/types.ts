/**
 * Enterprise Creator Intelligence — Creator Investment Intelligence (Sprint 6)
 *
 * Business investment recommendation engine — not a Discovery influencer score.
 * Consumes Sprint 1–5 intelligence only; never duplicates layer calculations.
 */

import type { EvidenceCoverage } from "@/lib/enterprise-creator-intelligence/shared/types";

export type InvestmentRecommendation =
  | "Highly Recommended"
  | "Recommended"
  | "Consider"
  | "High Risk"
  | "Insufficient Data";

export type InvestmentDimensionKey =
  | "commercial_efficiency"
  | "performance_reliability"
  | "audience_quality"
  | "audience_stability"
  | "growth_stability"
  | "category_expertise"
  | "brand_affinity"
  | "campaign_success"
  | "operational_reliability"
  | "content_consistency"
  | "pricing_stability"
  | "commercial_confidence"
  | "business_readiness";

export type InvestmentRiskSeverity = "Critical" | "High" | "Medium" | "Low";

export type InvestmentSource = {
  platform: string | null;
  collectionMethod: string;
  refreshTime: string | null;
  confidence: number | null;
};

export type InvestmentConfidence = {
  percent: number | null;
  reason: string;
  basedOn: Array<{ label: string; value: string | number }>;
};

export type InvestmentExplainability = {
  value: string | number | null;
  meaning: string;
  reason: string;
  evidence: string[];
  confidence: number | null;
  historicalTrend: string;
  businessContext: string;
  source: InvestmentSource;
  lastUpdated: string | null;
  missingInputs: string[];
};

export type InvestmentDimensionScore = {
  key: InvestmentDimensionKey;
  label: string;
  score: number | null;
  confidence: number | null;
  weight: number;
  weightedContribution: number | null;
  explanation: string;
  supportingEvidence: string[];
  historicalTrend: string;
  source: InvestmentSource;
  lastUpdated: string | null;
  missingInputs: string[];
  explainability: InvestmentExplainability;
};

export type InvestmentRisk = {
  key: string;
  label: string;
  severity: InvestmentRiskSeverity;
  explanation: string;
  suggestedAction: string;
  evidence: string[];
};

export type InvestmentOpportunity = {
  key: string;
  label: string;
  explanation: string;
  evidence: string[];
  businessContext: string;
};

export type InvestmentRecommendationInsight = {
  recommendation: InvestmentRecommendation;
  why: string;
  confidence: InvestmentConfidence;
  score: number | null;
  scoreMeaning: string;
  basedOnLayers: string[];
  explainability: InvestmentExplainability;
};

export type InvestmentBusinessReadiness = {
  planningWorkspace: string;
  clientWorkspace: string;
  campaignWorkspace: string;
  reporting: string;
  enterpriseAnalytics: string;
  aiCopilot: string;
  mobile: string;
  overall: InvestmentRecommendation;
  commercialAudienceReady: boolean;
  commercialReady: boolean;
  performanceReliable: boolean;
  missingInputs: string[];
};

export type CreatorInvestmentAiHints = {
  available: boolean;
  recommendation: InvestmentRecommendation | null;
  score: number | null;
  confidencePercent: number | null;
  topStrengths: string[];
  topRisks: string[];
  scoreDrivers: Array<{ dimension: string; contribution: number | null }>;
  recommendRefresh: boolean;
  /** AI-ready narrative hooks — no AI execution. */
  explainWhyRecommended: string;
  explainConfidenceDrivers: string;
  explainScoreMovement: string;
  suggestBusinessActions: string[];
};

export type CreatorInvestmentIntelligence = {
  influencerId: string;
  platform: string | null;
  computedAt: string;
  overallScore: number | null;
  recommendation: InvestmentRecommendationInsight;
  dimensions: InvestmentDimensionScore[];
  risks: InvestmentRisk[];
  opportunities: InvestmentOpportunity[];
  businessReadiness: InvestmentBusinessReadiness;
  /** Completeness of investment information — not Confidence. */
  evidenceCoverage: EvidenceCoverage;
  source: InvestmentSource;
  aiHints: CreatorInvestmentAiHints;
  consumers: readonly string[];
  /** Declares which Sprint layers contributed. */
  layerCoverage: {
    historical: boolean;
    commercial: boolean;
    categoryBrand: boolean;
    performance: boolean;
    audience: boolean;
  };
};

export const INVESTMENT_CONSUMERS = [
  "Planning Workspace",
  "Client Workspace",
  "Campaign Workspace",
  "Reporting Hub",
  "Enterprise Analytics",
  "AI Copilot",
  "Mobile",
] as const;

/** Weights sum to 1.0 — independently explainable dimensions. */
export const INVESTMENT_DIMENSION_WEIGHTS: Record<InvestmentDimensionKey, number> =
  {
    commercial_efficiency: 0.12,
    performance_reliability: 0.1,
    audience_quality: 0.09,
    audience_stability: 0.08,
    growth_stability: 0.07,
    category_expertise: 0.07,
    brand_affinity: 0.06,
    campaign_success: 0.1,
    operational_reliability: 0.07,
    content_consistency: 0.05,
    pricing_stability: 0.06,
    commercial_confidence: 0.07,
    business_readiness: 0.06,
  };

export const INVESTMENT_DIMENSION_LABELS: Record<InvestmentDimensionKey, string> =
  {
    commercial_efficiency: "Commercial Efficiency",
    performance_reliability: "Performance Reliability",
    audience_quality: "Audience Quality",
    audience_stability: "Audience Stability",
    growth_stability: "Growth Stability",
    category_expertise: "Category Expertise",
    brand_affinity: "Brand Affinity",
    campaign_success: "Campaign Success",
    operational_reliability: "Operational Reliability",
    content_consistency: "Content Consistency",
    pricing_stability: "Pricing Stability",
    commercial_confidence: "Commercial Confidence",
    business_readiness: "Business Readiness",
  };
