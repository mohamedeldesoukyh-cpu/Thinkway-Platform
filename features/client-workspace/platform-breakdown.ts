import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import type { UnifiedCreatorResult } from "@/lib/domains/creator/types";

import {
  sortClientPlatforms,
  splitPlatformTokens,
  summarizeDeliverablesByPlatform,
} from "./deliverables";
import type {
  ClientCreatorBrief,
  ClientCreatorCard,
  ClientCreatorPlatformStats,
  ClientDeliverableItem,
} from "./types";

export type ClientPlatformBreakdownRow = ClientCreatorPlatformStats & {
  lines: Array<{ key: string; label: string; quantity: number }>;
};

function optionalMetric(value: number | null | undefined): number | undefined {
  return value != null && Number.isFinite(value) ? value : undefined;
}

export function formatPlatformHandle(handle?: string | null): string | undefined {
  const trimmed = handle?.trim();
  if (!trimmed) return undefined;
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

function definedStats(row: ClientCreatorPlatformStats): ClientCreatorPlatformStats {
  const next: ClientCreatorPlatformStats = { platform: row.platform };
  if (row.handle) next.handle = row.handle;
  if (row.followers != null) next.followers = row.followers;
  if (row.engagementRate != null) next.engagementRate = row.engagementRate;
  if (row.avgLikes != null) next.avgLikes = row.avgLikes;
  if (row.avgComments != null) next.avgComments = row.avgComments;
  if (row.avgViews != null) next.avgViews = row.avgViews;
  if (row.profileUrl) next.profileUrl = row.profileUrl;
  return next;
}

export function fallbackPlatformStats(input: {
  platform?: string;
  handle?: string;
  followers?: number;
  engagementRate?: number;
  avgLikes?: number;
  avgComments?: number;
  avgViews?: number;
  profileUrl?: string;
}): ClientCreatorPlatformStats[] {
  const keys = splitPlatformTokens(input.platform);
  if (keys.length !== 1) return [];
  return [
    definedStats({
      platform: keys[0]!,
      handle: formatPlatformHandle(input.handle),
      followers: input.followers,
      engagementRate: input.engagementRate,
      avgLikes: input.avgLikes,
      avgComments: input.avgComments,
      avgViews: input.avgViews,
      profileUrl: input.profileUrl,
    }),
  ];
}

export function mergePlatformStats(
  ...lists: Array<ClientCreatorPlatformStats[] | undefined>
): ClientCreatorPlatformStats[] {
  const map = new Map<string, ClientCreatorPlatformStats>();
  for (const list of lists) {
    for (const row of list ?? []) {
      const key = canonicalPlatformKey(row.platform);
      if (!key) continue;
      const prev = map.get(key);
      map.set(key, definedStats({ ...(prev ?? { platform: key }), ...row, platform: key }));
    }
  }
  return sortClientPlatforms([...map.keys()]).map((key) => map.get(key)!);
}

export function platformStatsFromUnified(
  creator: UnifiedCreatorResult | undefined
): ClientCreatorPlatformStats[] {
  if (!creator?.platforms?.length) return [];
  const rows: ClientCreatorPlatformStats[] = [];
  const seen = new Set<string>();
  for (const platform of creator.platforms) {
    const key = canonicalPlatformKey(platform.platform);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    rows.push(
      definedStats({
        platform: key,
        handle: formatPlatformHandle(platform.handle),
        followers: optionalMetric(platform.follower_count),
        engagementRate: optionalMetric(platform.engagement_rate),
        avgLikes: optionalMetric(platform.avg_likes),
        avgComments: optionalMetric(platform.avg_comments),
        avgViews: optionalMetric(platform.avg_views),
        profileUrl: platform.profile_url || undefined,
      })
    );
  }
  return rows;
}

export function creatorPlatformBreakdown(input: {
  deliverableItems?: ClientDeliverableItem[];
  platformAccounts?: ClientCreatorPlatformStats[];
  fallback?: {
    platform?: string;
    handle?: string;
    followers?: number;
    engagementRate?: number;
    avgLikes?: number;
    avgComments?: number;
    avgViews?: number;
    profileUrl?: string;
  };
}): ClientPlatformBreakdownRow[] {
  const groups = summarizeDeliverablesByPlatform(input.deliverableItems);
  const accounts = mergePlatformStats(
    fallbackPlatformStats(input.fallback ?? {}),
    input.platformAccounts
  );
  const accountMap = new Map(accounts.map((row) => [row.platform, row]));
  const deliverableKeys = groups.map((group) => group.platform).filter((key) => key !== "_other");
  const keys =
    deliverableKeys.length > 0
      ? deliverableKeys
      : accounts.map((row) => row.platform);
  const other = groups.find((group) => group.platform === "_other");
  const rows = keys.map((platform) => {
    const account = accountMap.get(platform);
    const lines = groups.find((group) => group.platform === platform)?.lines ?? [];
    return {
      platform,
      handle: account?.handle,
      followers: account?.followers,
      engagementRate: account?.engagementRate,
      avgLikes: account?.avgLikes,
      avgComments: account?.avgComments,
      avgViews: account?.avgViews,
      profileUrl: account?.profileUrl,
      lines,
    };
  });
  if (other?.lines.length) {
    rows.push({ platform: "_other", lines: other.lines });
  }
  return rows;
}

export function breakdownForCreator(
  creator: Pick<
    ClientCreatorCard,
    | "deliverableItems"
    | "platformAccounts"
    | "platform"
    | "handle"
    | "followers"
    | "engagementRate"
    | "avgLikes"
    | "avgComments"
    | "avgViews"
    | "profileUrl"
  >,
  brief?: Pick<
    ClientCreatorBrief,
    | "deliverableItems"
    | "platformAccounts"
    | "platform"
    | "handle"
    | "followers"
    | "engagementRate"
  > | null
): ClientPlatformBreakdownRow[] {
  return creatorPlatformBreakdown({
    deliverableItems: brief?.deliverableItems?.length
      ? brief.deliverableItems
      : creator.deliverableItems,
    platformAccounts: brief?.platformAccounts?.length
      ? brief.platformAccounts
      : creator.platformAccounts,
    fallback: {
      platform: brief?.platform || creator.platform,
      handle: brief?.handle || creator.handle,
      followers: brief?.followers ?? creator.followers,
      engagementRate: brief?.engagementRate ?? creator.engagementRate,
      avgLikes: creator.avgLikes,
      avgComments: creator.avgComments,
      avgViews: creator.avgViews,
      profileUrl: creator.profileUrl,
    },
  });
}
