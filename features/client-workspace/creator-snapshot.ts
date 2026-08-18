import { resolveCreatorTierLabel } from "@/lib/creators/creator-tier";
import { resolveCreatorRecentPublicationThumbnail } from "@/lib/creators/recent-publication-thumb";
import type { CreatorRecentPublication, UnifiedCreatorResult } from "@/lib/domains/creator/types";
import { isInstagramCdnUrlExpired } from "@/lib/performance/avatar-sync-policy";
import { computeEngagementRate } from "@/lib/performance/engagement-rate-engine";

import { clientSafeFitCopy } from "./format";
import type { ClientContentPost, ClientReviewSourceSnapshotCreator } from "./types";

export function optionalMetric(value: number | null | undefined): number | undefined {
  return value != null && Number.isFinite(value) ? value : undefined;
}

export function contentPostsFromPublications(
  publications: CreatorRecentPublication[] | undefined,
  platform?: string
): ClientContentPost[] {
  if (!publications?.length) return [];
  return publications.slice(0, 12).map((pub) => {
    const engagement = computeEngagementRate({
      views: pub.views,
      likes: pub.likes,
      comments: pub.comments,
    });
    return {
      url: pub.url,
      thumbnail: resolveCreatorRecentPublicationThumbnail(pub) ?? pub.thumbnail,
      platform,
      postedAt: pub.posted_at,
      likes: optionalMetric(pub.likes) ?? null,
      comments: optionalMetric(pub.comments) ?? null,
      views: optionalMetric(pub.views) ?? null,
      engagementRate: engagement.engagement_rate ?? null,
    };
  });
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
    };
  }
  const platform = creator.platforms[0];
  const publications =
    platform?.recent_publications?.length
      ? platform.recent_publications
      : creator.recent_publications;
  const contentFeed = contentPostsFromPublications(publications, platform?.platform ?? base.platform);
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
