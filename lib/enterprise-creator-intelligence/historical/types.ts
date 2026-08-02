/**
 * Enterprise Creator Intelligence — Historical (Sprint 1)
 * Monthly time-series primitives + derived growth.
 * Canonical historical foundation — not a full insight engine.
 */

import type { CreatorHistoricalExplainability } from "@/lib/enterprise-creator-intelligence/historical/explainability";
import type { EvidenceCoverage } from "@/lib/enterprise-creator-intelligence/shared/types";

export type CreatorIntelligencePlatform = string;

export type CreatorMetricsCaptureInput = {
  influencerId: string;
  platform: string;
  capturedAt?: string | Date;
  followers: number | null;
  following: number | null;
  postsCount: number | null;
  avgViews: number | null;
  medianViews: number | null;
  engagementRate: number | null;
  postingFrequencyPerWeek: number | null;
  source?: string;
  iplSnapshotId?: string | null;
  metadata?: Record<string, unknown>;
};

/** One month of historical creator intelligence. */
export type CreatorMonthlyMetrics = {
  influencerId: string;
  platform: string;
  /** ISO date — first day of UTC month (YYYY-MM-01). */
  periodMonth: string;
  followers: number | null;
  following: number | null;
  postsCount: number | null;
  avgViews: number | null;
  medianViews: number | null;
  engagementRate: number | null;
  postingFrequencyPerWeek: number | null;
  /** (followers - prior.followers) / prior.followers when prior exists. */
  monthlyGrowthRate: number | null;
  /** followers - prior.followers when prior exists. */
  followerDifference: number | null;
  sampleCaptureCount: number;
  source: string;
  computedAt: string;
};

export type CreatorHistoricalMonthlySeries = {
  influencerId: string;
  platform: string | null;
  months: CreatorMonthlyMetrics[];
  /** Completeness of historical information — not Confidence. */
  evidenceCoverage: EvidenceCoverage;
  /** Lightweight wrapper — Sprint 1 rows remain series primitives. */
  explainability: CreatorHistoricalExplainability;
};

/** AI-ready hook — no AI execution in Sprint 1. */
export type CreatorHistoricalAiHints = {
  seriesAvailable: boolean;
  monthCount: number;
  latestPeriodMonth: string | null;
  growthTrend: "up" | "down" | "flat" | "unknown";
  recommendRefresh: boolean;
};
