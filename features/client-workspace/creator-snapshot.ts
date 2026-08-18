import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { resolveCreatorTierLabel } from "@/lib/creators/creator-tier";
import { resolveCreatorRecentPublicationThumbnail } from "@/lib/creators/recent-publication-thumb";
import type { CreatorRecentPublication, UnifiedCreatorResult } from "@/lib/domains/creator/types";
import { isInstagramCdnUrlExpired } from "@/lib/performance/avatar-sync-policy";
import { computeEngagementRate } from "@/lib/performance/engagement-rate-engine";
import { detectSocialPlatformFromContentUrl } from "@/lib/social/platforms";

import { summarizeCreatorDeliverables } from "./deliverables";
import { clientSafeFitCopy } from "./format";
import {
  fallbackPlatformStats,
  mergePlatformStats,
  platformStatsFromUnified,
} from "./platform-breakdown";
import type { ClientContentPost, ClientDeliverableItem, ClientReviewSourceSnapshotCreator } from "./types";

export function optionalMetric(value: number | null | undefined): number | undefined {
  return value != null && Number.isFinite(value) ? value : undefined;
}

export function contentPostsFromPublications(
  publications: CreatorRecentPublication[] | undefined,
  platform?: string,
  limit = 8
): ClientContentPost[] {
  if (!publications?.length) return [];
  return publications.slice(0, limit).map((pub) => {
    const engagement = computeEngagementRate({
      views: pub.views,
      likes: pub.likes,
      comments: pub.comments,
    });
    const inferred = detectSocialPlatformFromContentUrl(pub.url) ?? undefined;
    return {
      url: pub.url,
      thumbnail: resolveCreatorRecentPublicationThumbnail(pub) ?? pub.thumbnail,
      platform: inferred || platform,
      postedAt: pub.posted_at,
      likes: optionalMetric(pub.likes) ?? null,
      comments: optionalMetric(pub.comments) ?? null,
      views: optionalMetric(pub.views) ?? null,
      engagementRate: engagement.engagement_rate ?? null,
    };
  });
}

export function mixPostsForDeliverables(
  posts: ClientContentPost[],
  items?: ClientDeliverableItem[],
  limit = 6
): ClientContentPost[] {
  if (!posts.length || limit <= 0) return [];
  const normalized = posts.map((post) => ({
    ...post,
    platform:
      detectSocialPlatformFromContentUrl(post.url) ??
      canonicalPlatformKey(post.platform) ??
      post.platform,
  }));
  const preferred = preferredPublicationPlatforms(items, normalized);
  if (preferred.length <= 1) return normalized.slice(0, limit);

  const buckets = new Map<string, ClientContentPost[]>();
  const unmatched: ClientContentPost[] = [];
  for (const post of normalized) {
    const key = canonicalPlatformKey(post.platform);
    if (key && preferred.includes(key)) {
      const list = buckets.get(key) ?? [];
      list.push(post);
      buckets.set(key, list);
    } else {
      unmatched.push(post);
    }
  }

  const mixed: ClientContentPost[] = [];
  let round = 0;
  while (mixed.length < limit) {
    let added = false;
    for (const platform of preferred) {
      const next = buckets.get(platform)?.[round];
      if (!next) continue;
      mixed.push(next);
      added = true;
      if (mixed.length >= limit) break;
    }
    if (!added) break;
    round += 1;
  }
  for (const post of unmatched) {
    if (mixed.length >= limit) break;
    mixed.push(post);
  }
  if (mixed.length < limit) {
    const used = new Set(mixed);
    for (const post of normalized) {
      if (mixed.length >= limit) break;
      if (!used.has(post)) mixed.push(post);
    }
  }
  return mixed;
}

function preferredPublicationPlatforms(
  items: ClientDeliverableItem[] | undefined,
  posts: ClientContentPost[]
): string[] {
  const fromDeliverables = summarizeCreatorDeliverables(items).platforms;
  if (fromDeliverables.length > 0) return fromDeliverables;
  const fromPosts = [
    ...new Set(
      posts
        .map((post) => canonicalPlatformKey(post.platform))
        .filter((platform): platform is string => Boolean(platform))
    ),
  ];
  return fromPosts;
}

function contentFeedFromUnified(
  creator: UnifiedCreatorResult,
  fallbackPlatform?: string
): ClientContentPost[] {
  const seen = new Set<string>();
  const posts: ClientContentPost[] = [];
  const append = (publications: CreatorRecentPublication[] | undefined, platform?: string) => {
    for (const post of contentPostsFromPublications(publications, platform, 6)) {
      const key = post.url || post.thumbnail;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      posts.push(post);
    }
  };
  for (const platform of creator.platforms ?? []) {
    append(platform.recent_publications, platform.platform);
  }
  if (posts.length === 0) {
    append(creator.recent_publications, creator.platforms?.[0]?.platform ?? fallbackPlatform);
  }
  return posts;
}

export function shouldReplaceContentFeed(
  existing: ClientContentPost[] | undefined,
  live: ClientContentPost[] | undefined
): boolean {
  if (!live?.length) return false;
  if (!existing?.length) return true;
  const existingHasMetrics = existing.some(
    (post) => post.likes != null || post.comments != null || post.views != null
  );
  if (existingHasMetrics && live.length <= existing.length) return false;
  return live.length > existing.length || !existingHasMetrics;
}

export function profileUrlFromHandle(handle?: string | null, platform?: string | null): string | undefined {
  const username = handle?.trim().replace(/^@/, "") ?? "";
  if (!username || /[/?#\s]/.test(username)) return undefined;
  const network = platform?.trim().toLowerCase() ?? "";
  if (network === "instagram") return `https://www.instagram.com/${username}/`;
  if (network === "tiktok") return `https://www.tiktok.com/@${username}`;
  if (network === "facebook") return `https://www.facebook.com/${username}`;
  return undefined;
}

function preferAvatarUrl(current?: string | null, live?: string | null): string | undefined {
  const next = live?.trim() || undefined;
  const existing = current?.trim() || undefined;
  if (!existing) return next;
  if (next && isInstagramCdnUrlExpired(existing)) return next;
  return existing;
}

export function influencerIdFromRefs(input: {
  influencerId?: string | null;
  creatorId?: string;
}): string | undefined {
  if (input.influencerId?.trim()) return input.influencerId.trim();
  const id = input.creatorId?.trim();
  if (id?.startsWith("inf:") && id.length > 4) return id.slice(4);
  return undefined;
}

export function enrichSnapshotCreatorFromUnified(
  base: ClientReviewSourceSnapshotCreator,
  creator: UnifiedCreatorResult | undefined
): ClientReviewSourceSnapshotCreator {
  if (!creator) {
    return {
      ...base,
      profileUrl: base.profileUrl || profileUrlFromHandle(base.handle, base.platform),
      platformAccounts: base.platformAccounts?.length
        ? base.platformAccounts
        : fallbackPlatformStats(base),
    };
  }
  const platform = creator.platforms[0];
  const contentFeed = contentFeedFromUnified(creator, platform?.platform ?? base.platform);
  const followers =
    optionalMetric(creator.metrics.followers.value) ??
    optionalMetric(platform?.follower_count) ??
    base.followers;
  const engagementRate =
    optionalMetric(creator.metrics.engagement_rate.value) ??
    optionalMetric(platform?.engagement_rate) ??
    base.engagementRate;
  const categories = [
    ...new Set(
      [...(base.categories ?? []), ...creator.categories, creator.ai_category ?? ""].filter(Boolean)
    ),
  ];
  return {
    ...base,
    displayName: base.displayName || creator.display_name,
    handle:
      base.handle ||
      (platform?.handle
        ? platform.handle.startsWith("@")
          ? platform.handle
          : `@${platform.handle}`
        : undefined),
    platform: base.platform || platform?.platform,
    platformAccounts: mergePlatformStats(
      fallbackPlatformStats(base),
      base.platformAccounts,
      platformStatsFromUnified(creator)
    ),
    followers,
    engagementRate,
    country: base.country || creator.estimated_country || creator.country_code || undefined,
    city: base.city || creator.city || undefined,
    category: base.category || categories[0] || creator.ai_category || undefined,
    niche: base.niche || creator.ai_niche || undefined,
    categories: categories.length > 0 ? categories : undefined,
    audienceHighlight:
      base.audienceHighlight || creator.audience_interests?.slice(0, 3).join(" · ") || undefined,
    avatarUrl: preferAvatarUrl(
      base.avatarUrl,
      creator.primaryAvatarUrl || creator.profile_image_url
    ),
    profileUrl:
      base.profileUrl ||
      platform?.profile_url ||
      profileUrlFromHandle(base.handle || platform?.handle, base.platform || platform?.platform),
    bio: base.bio || creator.bio || undefined,
    avgLikes:
      base.avgLikes ??
      optionalMetric(creator.metrics.avg_likes.value) ??
      optionalMetric(platform?.avg_likes),
    avgComments:
      base.avgComments ??
      optionalMetric(creator.metrics.avg_comments.value) ??
      optionalMetric(platform?.avg_comments),
    avgViews:
      base.avgViews ??
      optionalMetric(creator.metrics.avg_views.value) ??
      optionalMetric(platform?.avg_views),
    tier: base.tier || resolveCreatorTierLabel({ followers, role: creator.role }),
    contentFeed: shouldReplaceContentFeed(base.contentFeed, contentFeed)
      ? contentFeed
      : (base.contentFeed ?? contentFeed),
    influencerId: base.influencerId || influencerIdFromRefs({ influencerId: creator.influencer_id, creatorId: creator.unified_id }),
  };
}

export function attachMatchExplanation(
  creator: ClientReviewSourceSnapshotCreator,
  input: {
    matchPercent?: number | null;
    matchConfidence?: number | null;
    why?: string | null;
    audienceMatch?: string | null;
    evidence?: string | null;
  }
): ClientReviewSourceSnapshotCreator {
  const matchPercent = optionalMetric(input.matchPercent);
  const matchConfidence = optionalMetric(input.matchConfidence);
  const fit =
    clientSafeFitCopy(input.why ?? undefined) ||
    clientSafeFitCopy(input.audienceMatch ?? undefined);
  const evidence = input.evidence
    ? input.evidence
        .split(/[;|]/)
        .map((part) => clientSafeFitCopy(part.trim()))
        .filter((part): part is string => Boolean(part))
        .slice(0, 4)
    : undefined;
  return {
    ...creator,
    matchPercent,
    matchConfidence,
    matchExplanation: fit,
    matchEvidence: evidence?.length ? evidence : undefined,
    fitExplanation: creator.fitExplanation || fit,
  };
}
