import type { UnifiedCreatorResult } from "@/lib/domains/creator/types";

import {
  canonicalTierLabel,
  formatTierLabel,
  getInfluencerTier,
  normalizeInfluencerTier,
  type InfluencerTier,
} from "@/lib/creators/influencer-tier";

export type { InfluencerTier } from "@/lib/creators/influencer-tier";
export {
  canonicalTierLabel,
  formatTierLabel,
  getInfluencerTier,
  getTierFollowerRange,
  INFLUENCER_TIER_ORDER,
  INFLUENCER_TIER_THRESHOLDS,
  matchesInfluencerTier,
  normalizeInfluencerTier,
  TIER_FILTER_RANGES,
  tierFilterPresetFields,
} from "@/lib/creators/influencer-tier";

/** Follower-based creator tier labels — re-exported from influencer-tier SSOT. */
export type CreatorTierLabel = InfluencerTier | "Unknown";

/** Map stored role / import tier text to a display label. */
export function parseCreatorTierFromRole(role?: string | null): CreatorTierLabel | null {
  const fromRole = normalizeInfluencerTier(role);
  return fromRole;
}

/** Resolve creator tier from follower count (primary) or imported role (override). */
export function resolveCreatorTierLabel(input: {
  followers?: number | null;
  role?: string | null;
}): CreatorTierLabel {
  const fromRole = parseCreatorTierFromRole(input.role);
  if (fromRole) return fromRole;

  const followers = input.followers;
  if (followers == null || followers <= 0) return "Unknown";
  return getInfluencerTier(followers);
}

/** Primary follower count for tier — aggregated metrics, then max platform account. */
export function resolvePrimaryFollowerCount(input: {
  metricsFollowers?: number | null;
  platformFollowers?: Array<number | null | undefined>;
}): number | null {
  const fromMetrics = input.metricsFollowers;
  if (fromMetrics != null && fromMetrics > 0) return fromMetrics;

  const platformValues = (input.platformFollowers ?? []).filter(
    (value): value is number => value != null && value > 0
  );
  if (platformValues.length === 0) return null;
  return Math.max(...platformValues);
}

export function resolveCreatorTierFromUnified(creator: UnifiedCreatorResult): CreatorTierLabel {
  return resolveCreatorTierLabel({
    followers: resolvePrimaryFollowerCount({
      metricsFollowers: creator.metrics.followers.value,
      platformFollowers: creator.platforms.map((platform) => platform.follower_count),
    }),
    role: creator.role,
  });
}

export const CREATOR_TIER_BADGE_CLASS: Record<CreatorTierLabel, string> = {
  Celebrity: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  Mega: "border-orange-500/30 bg-orange-500/10 text-orange-800 dark:text-orange-300",
  Macro: "border-indigo-500/30 bg-indigo-500/10 text-indigo-800 dark:text-indigo-300",
  Mid: "border-violet-500/30 bg-violet-500/10 text-violet-800 dark:text-violet-300",
  Micro: "border-[#1D9E75]/30 bg-[#1D9E75]/10 text-[#178f69] dark:text-[#1D9E75]",
  Nano: "border-slate-400/30 bg-slate-400/10 text-slate-700 dark:text-slate-300",
  Unknown: "border-border bg-muted/50 text-muted-foreground",
};
