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

function optionalMetric(value: number | string | null | undefined): number | undefined {
  if (value == null || value === "") return undefined;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

const CLONED_ENGAGEMENT_EPSILON = 0.011;

function hasIndependentEngagementSignal(row: ClientCreatorPlatformStats): boolean {
  return row.avgLikes != null || row.avgComments != null;
}

/**
 * CRM/Excel imports often stamp one engagement rate onto every platform account.
 * Client Workspace only keeps that value on platforms that independently support it
 * (avg likes/comments), otherwise on Instagram, then the first account.
 */
export function dropClonedImportedEngagementRates(
  accounts: ClientCreatorPlatformStats[]
): ClientCreatorPlatformStats[] {
  const rated = accounts.filter(
    (row) => row.engagementRate != null && Number.isFinite(row.engagementRate)
  );
  if (rated.length < 2) return accounts;

  const keep = new Set<string>();
  const visited = new Set<string>();

  for (const row of rated) {
    const bucket = (row.engagementRate ?? 0).toFixed(3);
    if (visited.has(bucket)) continue;
    visited.add(bucket);
    const clones = rated.filter(
      (other) => Math.abs((other.engagementRate ?? 0) - (row.engagementRate ?? 0)) < CLONED_ENGAGEMENT_EPSILON
    );
    if (clones.length < 2) {
      keep.add(row.platform);
      continue;
    }
    const independent = clones.filter(hasIndependentEngagementSignal);
    if (independent.length > 0) {
      for (const item of independent) keep.add(item.platform);
      continue;
    }
    const primary =
      clones.find((item) => canonicalPlatformKey(item.platform) === "instagram") ?? clones[0];
    if (primary) keep.add(primary.platform);
  }

  return accounts.map((row) => {
    if (row.engagementRate == null || keep.has(row.platform)) return row;
    const clones = rated.filter(
      (other) => Math.abs((other.engagementRate ?? 0) - (row.engagementRate ?? 0)) < CLONED_ENGAGEMENT_EPSILON
    );
    if (clones.length < 2) return row;
    const next = { ...row };
    delete next.engagementRate;
    return next;
  });
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
  const accounts = dropClonedImportedEngagementRates(
    mergePlatformStats(fallbackPlatformStats(input.fallback ?? {}), input.platformAccounts)
  );
  const accountMap = new Map(accounts.map((row) => [row.platform, row]));
  const deliverableKeys = groups.map((group) => group.platform).filter((key) => key !== "_other");
  const keys =
    deliverableKeys.length > 0
      ? deliverableKeys
      : accounts.map((row) => row.platform);
  const other = groups.find((group) => group.platform === "_other");
  const rows: ClientPlatformBreakdownRow[] = keys.map((platform) => {
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

export type ClientEngagementMeter = {
  platform?: string;
  rate?: number;
};

export function engagementMetersForBreakdown(
  rows: ClientPlatformBreakdownRow[],
  fallbackRate?: number | null
): ClientEngagementMeter[] {
  const platforms = rows.filter((row) => row.platform && row.platform !== "_other");
  if (platforms.length === 0) {
    return [{ rate: fallbackRate ?? undefined }];
  }
  return platforms.map((row) => ({
    platform: row.platform,
    rate: row.engagementRate ?? (platforms.length === 1 ? fallbackRate ?? undefined : undefined),
  }));
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
    platformAccounts: creator.platformAccounts?.length
      ? creator.platformAccounts
      : brief?.platformAccounts,
    fallback: {
      platform: creator.platform || brief?.platform,
      handle: creator.handle || brief?.handle,
      followers: creator.followers ?? brief?.followers,
      engagementRate: creator.engagementRate ?? brief?.engagementRate,
      avgLikes: creator.avgLikes,
      avgComments: creator.avgComments,
      avgViews: creator.avgViews,
      profileUrl: creator.profileUrl,
    },
  });
}

export function safeHttpUrl(url?: string | null): string | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
    return parsed.href;
  } catch {
    return undefined;
  }
}

export function profileUrlForPlatform(
  platform: string,
  handle?: string,
  profileUrl?: string
): string | undefined {
  const direct = safeHttpUrl(profileUrl);
  if (direct) return direct;
  const username = handle?.trim().replace(/^@/, "") ?? "";
  if (!username || /[/?#\s]/.test(username)) return undefined;
  const key = canonicalPlatformKey(platform);
  if (key === "instagram") return `https://www.instagram.com/${username}/`;
  if (key === "tiktok") return `https://www.tiktok.com/@${username}`;
  if (key === "youtube") return `https://www.youtube.com/@${username}`;
  if (key === "facebook") return `https://www.facebook.com/${username}`;
  return undefined;
}

/** Platforms whose public profile pages can yield a photo. Snapchat add-pages cannot. */
const AVATAR_FETCH_PLATFORM_ORDER = ["instagram", "tiktok", "youtube", "facebook"] as const;

export function avatarProfileUrlForReview(input: {
  profileUrl?: string | null;
  handle?: string | null;
  platform?: string | null;
  platformAccounts?: Array<{ platform: string; handle?: string; profileUrl?: string }>;
}): string | undefined {
  for (const key of AVATAR_FETCH_PLATFORM_ORDER) {
    const row = input.platformAccounts?.find(
      (account) => canonicalPlatformKey(account.platform) === key
    );
    if (!row) continue;
    const url = profileUrlForPlatform(key, row.handle, row.profileUrl);
    if (url) return url;
  }

  const primaryKey = canonicalPlatformKey(input.platform);
  if (
    primaryKey &&
    (AVATAR_FETCH_PLATFORM_ORDER as readonly string[]).includes(primaryKey)
  ) {
    const url = profileUrlForPlatform(
      primaryKey,
      input.handle ?? undefined,
      input.profileUrl ?? undefined
    );
    if (url) return url;
  }

  const stored = safeHttpUrl(input.profileUrl);
  if (stored && !/snapchat\.com/i.test(stored)) return stored;
  return stored;
}

export type ClientCreatorProfileLink = {
  platform: string;
  url: string;
  handle?: string;
};

export function creatorProfileLinks(
  rows: ClientPlatformBreakdownRow[],
  fallback?: { platform?: string; handle?: string; profileUrl?: string }
): ClientCreatorProfileLink[] {
  const links: ClientCreatorProfileLink[] = [];
  const seen = new Set<string>();
  const sources = [
    ...rows,
    ...(fallback
      ? [
          {
            platform: fallback.platform || "",
            handle: fallback.handle,
            profileUrl: fallback.profileUrl,
            lines: [],
          } satisfies ClientPlatformBreakdownRow,
        ]
      : []),
  ];
  for (const row of sources) {
    if (!row.platform || row.platform === "_other") continue;
    const url = profileUrlForPlatform(row.platform, row.handle, row.profileUrl);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    links.push({ platform: row.platform, url, handle: formatPlatformHandle(row.handle) });
  }
  return links;
}
