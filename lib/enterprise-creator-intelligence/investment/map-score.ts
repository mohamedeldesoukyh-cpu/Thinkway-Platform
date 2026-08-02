/**
 * Map Sprint 1–5 classification labels → 0–100 dimension scores.
 * Pure mapping — never recalculates commercial/performance/audience engines.
 */

import type { CommercialHealthLevel } from "@/lib/enterprise-creator-intelligence/commercial/types";
import type {
  AudienceGrowthTrend,
  AudienceQualityLevel,
  AudienceStabilityLevel,
} from "@/lib/enterprise-creator-intelligence/audience/types";
import type {
  ContentConsistencyLevel,
  SpecialisationLevel,
} from "@/lib/enterprise-creator-intelligence/category-brand/types";
import type {
  PerformanceReliabilityLevel,
  PerformanceTrendLabel,
  PublishingEffectivenessLevel,
} from "@/lib/enterprise-creator-intelligence/performance/types";
import type { InvestmentReadinessStatus } from "@/lib/enterprise-creator-intelligence/commercial/types";

export function mapCommercialHealthLevel(
  level: CommercialHealthLevel | null | undefined
): number | null {
  if (!level) return null;
  switch (level) {
    case "Excellent":
      return 95;
    case "Good":
      return 80;
    case "Monitor":
      return 60;
    case "Attention":
      return 40;
    case "Critical":
      return 20;
    default:
      return null;
  }
}

export function mapPerformanceReliability(
  level: PerformanceReliabilityLevel | null | undefined
): number | null {
  if (!level) return null;
  switch (level) {
    case "Highly Reliable":
      return 95;
    case "Reliable":
      return 80;
    case "Moderately Reliable":
      return 60;
    case "Unpredictable":
      return 35;
    case "Low Confidence":
      return 25;
    default:
      return null;
  }
}

export function mapAudienceQuality(
  level: AudienceQualityLevel | null | undefined
): number | null {
  if (!level) return null;
  switch (level) {
    case "High Quality":
      return 92;
    case "Good":
      return 78;
    case "Monitor":
      return 55;
    case "Low Confidence":
      return 35;
    case "Unknown":
      return null;
    default:
      return null;
  }
}

export function mapAudienceStability(
  level: AudienceStabilityLevel | null | undefined
): number | null {
  if (!level) return null;
  switch (level) {
    case "Highly Stable":
      return 95;
    case "Stable":
      return 82;
    case "Seasonal":
      return 65;
    case "Recovering":
      return 55;
    case "Volatile":
      return 30;
    default:
      return null;
  }
}

export function mapGrowthStability(
  trend: AudienceGrowthTrend | null | undefined,
  spikeCount: number,
  dropCount: number
): number | null {
  if (!trend || trend === "Unknown") return null;
  let base: number;
  switch (trend) {
    case "Growing":
      base = 88;
      break;
    case "Stable":
      base = 80;
      break;
    case "Declining":
      base = 40;
      break;
    case "Spike":
      base = 45;
      break;
    case "Drop":
      base = 30;
      break;
    default:
      return null;
  }
  const penalty = Math.min(40, spikeCount * 8 + dropCount * 12);
  return Math.max(10, Math.round(base - penalty));
}

export function mapSpecialisation(
  level: SpecialisationLevel | null | undefined
): number | null {
  if (!level) return null;
  switch (level) {
    case "Highly Specialised":
      return 92;
    case "Balanced":
      return 78;
    case "Generalist":
      return 62;
    case "Multi-category":
      return 55;
    case "Emerging Category Shift":
      return 42;
    default:
      return null;
  }
}

export function mapContentConsistency(
  level: ContentConsistencyLevel | null | undefined
): number | null {
  if (!level) return null;
  switch (level) {
    case "Highly Consistent":
      return 95;
    case "Generally Consistent":
      return 80;
    case "Mixed":
      return 60;
    case "Frequently Changing":
      return 40;
    case "Highly Volatile":
      return 25;
    default:
      return null;
  }
}

export function mapPublishingEffectiveness(
  level: PublishingEffectivenessLevel | null | undefined
): number | null {
  if (!level) return null;
  switch (level) {
    case "High consistency":
      return 90;
    case "Medium consistency":
      return 70;
    case "Irregular":
      return 40;
    case "Dormant":
      return 20;
    default:
      return null;
  }
}

export function mapInvestmentReadiness(
  status: InvestmentReadinessStatus | null | undefined
): number | null {
  if (!status) return null;
  switch (status) {
    case "Commercial Ready":
      return 90;
    case "Limited Confidence":
      return 50;
    case "Insufficient Campaign History":
      return 45;
    case "Historical Only":
      return 40;
    case "Needs More Data":
      return 25;
    default:
      return null;
  }
}

export function mapCampaignSuccess(input: {
  roi: number | null;
  sampleCampaignCount: number;
  campaignSuccess: PerformanceTrendLabel | null;
}): number | null {
  const { roi, sampleCampaignCount, campaignSuccess } = input;
  if (sampleCampaignCount <= 0 && roi == null) return null;

  let score = 50;
  if (roi != null) {
    if (roi >= 1) score = 95;
    else if (roi >= 0.5) score = 85;
    else if (roi >= 0.2) score = 72;
    else if (roi >= 0) score = 58;
    else if (roi >= -0.25) score = 40;
    else score = 22;
  }

  if (campaignSuccess === "Improving") score = Math.min(100, score + 5);
  if (campaignSuccess === "Declining") score = Math.max(0, score - 10);
  if (campaignSuccess === "Volatile") score = Math.max(0, score - 8);

  if (sampleCampaignCount < 2) score = Math.round(score * 0.85);
  return Math.round(Math.min(100, Math.max(0, score)));
}

export function averageNullable(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((s, n) => s + n, 0) / nums.length);
}
