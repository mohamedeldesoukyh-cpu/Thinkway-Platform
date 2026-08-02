/**
 * Discovery browse / acquisition score ONLY.
 *
 * NOT Enterprise Creator Intelligence.
 * NOT Creator Investment SSOT.
 *
 * Planning · Client · Campaign · Reporting · Analytics · AI · Mobile must use
 * `loadCreatorIntelligenceBundle` from `@/lib/enterprise-creator-intelligence`.
 */
import type { UnifiedCreatorMetrics } from "@/lib/creators/types";
import { averageSourceConfidence } from "@/lib/creators/confidence";

export type ThinkwayScoreInput = {
  metrics: UnifiedCreatorMetrics;
  authenticity_score: number | null;
  brand_fit_score: number | null;
  profile_completeness: number;
  ai_category: string | null;
  ai_niche: string | null;
  bio: string | null;
  profile_image_url: string | null;
  platforms_count: number;
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}

export function computeThinkwayScore(input: ThinkwayScoreInput): number {
  const followers = input.metrics.followers.value ?? 0;
  const engagement = input.metrics.engagement_rate.value ?? 0;
  const posting = input.metrics.posting_frequency_per_week.value ?? 0;

  const engagementQuality = Math.min(engagement * 12, 40);
  const postingConsistency = Math.min(posting * 5, 15);
  const authenticity = (input.authenticity_score ?? 70) * 0.2;
  const completeness = input.profile_completeness * 0.15;
  const brandFit = (input.brand_fit_score ?? 50) * 0.15;
  const reachBand = Math.min(Math.log10(followers + 1) * 4, 12);

  const confidenceBoost =
    averageSourceConfidence([
      input.metrics.followers,
      input.metrics.engagement_rate,
      input.metrics.avg_likes,
    ]) * 0.08;

  return clampScore(
    engagementQuality +
      postingConsistency +
      authenticity +
      completeness +
      brandFit +
      reachBand +
      confidenceBoost
  );
}

export function profileCompletenessPercent(input: {
  display_name: string | null;
  bio: string | null;
  profile_image_url: string | null;
  platforms_count: number;
  country_code: string | null;
  categories: string[];
}): number {
  let score = 0;
  if (input.display_name?.trim()) score += 20;
  if (input.bio?.trim()) score += 20;
  if (input.profile_image_url) score += 15;
  if (input.platforms_count > 0) score += 20;
  if (input.country_code) score += 10;
  if (input.categories.length > 0) score += 15;
  return Math.min(100, score);
}
