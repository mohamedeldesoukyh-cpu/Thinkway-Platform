/**
 * Browse/search display metrics — never show "—" when data exists at any layer.
 *
 * Priority per platform row:
 * 1. Platform account stored value
 * 2. Derived engagement from platform avg_likes / avg_comments / followers
 * 3. Creator-level metrics (DNA-hydrated default account)
 * 4. Derived engagement from creator-level avgs + followers
 */

import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import {
  computeProfileEngagementRate,
  resolvePlatformEngagementRate,
} from "@/lib/creators/profile-engagement-rate";
import type { UnifiedCreatorPlatform, UnifiedCreatorResult } from "@/lib/creators/types";

import { isPositiveNumericMetric } from "./creator-display-utils";
import { resolvePlatformMetricsEmptyHint } from "./platform-metrics-empty-hint";

function isPrimaryPlatform(
  creator: Pick<UnifiedCreatorResult, "default_metrics_platform_account_id" | "platforms">,
  platform: UnifiedCreatorPlatform,
  index: number
): boolean {
  if (creator.default_metrics_platform_account_id && platform.id === creator.default_metrics_platform_account_id) {
    return true;
  }
  return index === 0;
}

function finiteNumber(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

/** Best follower count for a platform row in Search / browse UI. */
export function resolvePlatformBrowseFollowers(
  creator: UnifiedCreatorResult,
  platform: UnifiedCreatorPlatform,
  index: number
): number | null {
  if (isPositiveNumericMetric(platform.follower_count)) {
    return platform.follower_count;
  }

  if (isPrimaryPlatform(creator, platform, index) && isPositiveNumericMetric(creator.metrics.followers.value)) {
    return creator.metrics.followers.value;
  }

  return null;
}

/** Best engagement rate for a platform row in Search / browse UI. */
export function resolvePlatformBrowseEngagement(
  creator: UnifiedCreatorResult,
  platform: UnifiedCreatorPlatform,
  index: number
): number | null {
  const fromPlatform = resolvePlatformEngagementRate(platform);
  if (finiteNumber(fromPlatform)) return fromPlatform;

  const followers = resolvePlatformBrowseFollowers(creator, platform, index);
  if (isPositiveNumericMetric(followers)) {
    const derivedFromPlatformAvgs = computeProfileEngagementRate({
      avgLikes: platform.avg_likes,
      avgComments: platform.avg_comments,
      followers,
    });
    if (finiteNumber(derivedFromPlatformAvgs)) return derivedFromPlatformAvgs;

    if (isPrimaryPlatform(creator, platform, index)) {
      const derivedFromCreatorAvgs = computeProfileEngagementRate({
        avgLikes: creator.metrics.avg_likes.value,
        avgComments: creator.metrics.avg_comments.value,
        followers,
      });
      if (finiteNumber(derivedFromCreatorAvgs)) return derivedFromCreatorAvgs;
    }
  }

  if (isPrimaryPlatform(creator, platform, index)) {
    const metricsEr = creator.metrics.engagement_rate.value;
    if (finiteNumber(metricsEr)) return metricsEr;
  }

  return null;
}

export type PlatformBrowseStatRow = {
  key: string;
  platform: string | null;
  followers: number | null;
  engagement: number | null;
  avgViews: number | null;
  /** Shown when all three metrics are empty (e.g. Snapchat enrichment not configured). */
  metricsHint?: string | null;
};

/** Best avg views for a platform row in Search / browse UI. */
export function resolvePlatformBrowseAvgViews(
  creator: UnifiedCreatorResult,
  platform: UnifiedCreatorPlatform,
  index: number
): number | null {
  if (isPositiveNumericMetric(platform.avg_views)) {
    return platform.avg_views;
  }

  if (
    isPrimaryPlatform(creator, platform, index) &&
    isPositiveNumericMetric(creator.metrics.avg_views.value)
  ) {
    return creator.metrics.avg_views.value;
  }

  return null;
}

/** Resolve per-platform stat rows for Search exact-row Statistics column. */
export function resolveCreatorBrowsePlatformStats(
  creator: UnifiedCreatorResult
): PlatformBrowseStatRow[] {
  if (creator.platforms.length === 0) {
    const followers = isPositiveNumericMetric(creator.metrics.followers.value)
      ? creator.metrics.followers.value
      : null;
    let engagement = finiteNumber(creator.metrics.engagement_rate.value)
      ? creator.metrics.engagement_rate.value
      : null;
    if (engagement == null && isPositiveNumericMetric(followers)) {
      engagement = computeProfileEngagementRate({
        avgLikes: creator.metrics.avg_likes.value,
        avgComments: creator.metrics.avg_comments.value,
        followers,
      });
    }
    const avgViews = isPositiveNumericMetric(creator.metrics.avg_views.value)
      ? creator.metrics.avg_views.value
      : null;
    if (followers == null && engagement == null && avgViews == null) return [];
    return [
      {
        key: "creator-metrics",
        platform: creator.platforms[0]?.platform ?? null,
        followers,
        engagement,
        avgViews,
      },
    ];
  }

  return creator.platforms.map((platform, index) => ({
    key: platform.id || `${platform.platform}-${platform.handle ?? "na"}`,
    platform: platform.platform,
    followers: resolvePlatformBrowseFollowers(creator, platform, index),
    engagement: resolvePlatformBrowseEngagement(creator, platform, index),
    avgViews: resolvePlatformBrowseAvgViews(creator, platform, index),
    metricsHint: resolvePlatformMetricsEmptyHint(platform),
  }));
}
