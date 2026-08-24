import { pickCreatorDisplayName } from "@/lib/text/decode-html-entities";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { avatarStorageQualityRank } from "@/lib/creators/creator-centric";
import { resolveCreatorTierLabel } from "@/lib/creators/creator-tier";
import { resolveCreatorRecentPublicationThumbnail } from "@/lib/creators/recent-publication-thumb";
import { resolveDiscoveryCreatorDisplayCategories } from "@/lib/creators/creator-display-categories";
import { resolveCreatorFromRefLookup, resolveUnifiedCreatorsByRefs } from "@/lib/creators/unified-browse";
import { isImportedCreatorAvatarUrl } from "@/lib/discovery-import/import-avatar-storage";
import type { CreatorRecentPublication, UnifiedCreatorResult } from "@/lib/domains/creator/types";
import { isInstagramCdnUrlExpired } from "@/lib/performance/avatar-sync-policy";
import { computeEngagementRate } from "@/lib/performance/engagement-rate-engine";
import { detectSocialPlatformFromContentUrl } from "@/lib/social/platforms";
import type { SupabaseClient } from "@supabase/supabase-js";

import { summarizeCreatorDeliverables } from "./deliverables";
import { clientSafeFitCopy } from "./format";
import {
  fallbackPlatformStats,
  formatPlatformHandle,
  mergePlatformStats,
  platformStatsFromUnified,
} from "./platform-breakdown";
import type {
  ClientContentPost,
  ClientCreatorPlatformStats,
  ClientDeliverableItem,
  ClientReviewSourceSnapshot,
  ClientReviewSourceSnapshotCreator,
} from "./types";

export function optionalMetric(value: number | string | null | undefined): number | undefined {
  if (value == null || value === "") return undefined;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
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

export function resolveContentPostPlatform(
  post: Pick<ClientContentPost, "url" | "platform">
): string | undefined {
  const inferred = detectSocialPlatformFromContentUrl(post.url);
  if (inferred) return inferred;
  return canonicalPlatformKey(post.platform) || post.platform?.trim() || undefined;
}

export function mixPostsForDeliverables(
  posts: ClientContentPost[],
  items?: ClientDeliverableItem[],
  limit = 6
): ClientContentPost[] {
  if (!posts.length || limit <= 0) return [];
  const normalized = posts.map((post) => ({
    ...post,
    platform: resolveContentPostPlatform(post),
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
  const liveHasMetrics = live.some(
    (post) => post.likes != null || post.comments != null || post.views != null
  );
  if (liveHasMetrics) return true;
  const existingHasMetrics = existing.some(
    (post) => post.likes != null || post.comments != null || post.views != null
  );
  if (existingHasMetrics) return false;
  return live.length >= existing.length;
}

export function profileUrlFromHandle(handle?: string | null, platform?: string | null): string | undefined {
  const username = handle?.trim().replace(/^@/, "") ?? "";
  if (!username || /[/?#\s]/.test(username)) return undefined;
  const network = platform?.trim().toLowerCase() ?? "";
  if (network === "instagram") return `https://www.instagram.com/${username}/`;
  if (network === "tiktok") return `https://www.tiktok.com/@${username}`;
  if (network === "youtube") return `https://www.youtube.com/@${username}`;
  if (network === "facebook") return `https://www.facebook.com/${username}`;
  if (network === "snapchat") return `https://www.snapchat.com/add/${username}`;
  return undefined;
}

/** Prefer a live enrichment photo over a frozen CRM/Excel import crop. */
export function preferAvatarUrl(current?: string | null, live?: string | null): string | undefined {
  const next = live?.trim() || undefined;
  const existing = current?.trim() || undefined;
  if (!existing) return next;
  if (!next) return existing;
  if (isInstagramCdnUrlExpired(next) && !isInstagramCdnUrlExpired(existing)) return existing;
  if (isImportedCreatorAvatarUrl(next) && !isImportedCreatorAvatarUrl(existing)) return existing;
  if (isImportedCreatorAvatarUrl(existing) && !isImportedCreatorAvatarUrl(next)) return next;
  if (isInstagramCdnUrlExpired(existing)) return next;
  if (avatarStorageQualityRank(next) > avatarStorageQualityRank(existing)) return next;
  if (!isImportedCreatorAvatarUrl(next) && !isInstagramCdnUrlExpired(next)) return next;
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

export type CrmCreatorProfile = {
  avatarUrl?: string;
  accounts: ClientCreatorPlatformStats[];
};

function platformStatsFromCrmAccount(row: {
  platform?: string | null;
  handle?: string | null;
  profile_url?: string | null;
  follower_count?: number | string | null;
  engagement_rate?: number | string | null;
  avg_likes?: number | string | null;
  avg_comments?: number | string | null;
  avg_views?: number | string | null;
}): ClientCreatorPlatformStats | null {
  const platform = canonicalPlatformKey(row.platform);
  if (!platform) return null;
  const stats: ClientCreatorPlatformStats = { platform };
  const handle = formatPlatformHandle(row.handle);
  if (handle) stats.handle = handle;
  const followers = optionalMetric(row.follower_count);
  if (followers != null) stats.followers = followers;
  const engagementRate = optionalMetric(row.engagement_rate);
  if (engagementRate != null) stats.engagementRate = engagementRate;
  const avgLikes = optionalMetric(row.avg_likes);
  if (avgLikes != null) stats.avgLikes = avgLikes;
  const avgComments = optionalMetric(row.avg_comments);
  if (avgComments != null) stats.avgComments = avgComments;
  const avgViews = optionalMetric(row.avg_views);
  if (avgViews != null) stats.avgViews = avgViews;
  const profileUrl = row.profile_url?.trim();
  if (profileUrl) stats.profileUrl = profileUrl;
  return stats;
}

function bestCrmAvatarUrl(
  primary?: string | null,
  accountPictures?: Array<string | null | undefined>
): string | undefined {
  const candidates = [primary, ...(accountPictures ?? [])];
  const live = candidates.find(
    (url) => url?.trim() && !isImportedCreatorAvatarUrl(url) && !isInstagramCdnUrlExpired(url)
  );
  return live?.trim() || primary?.trim() || undefined;
}

/** Open reviews replace frozen import rows with live CRM platform accounts. */
export function applyCrmCreatorProfile(
  base: ClientReviewSourceSnapshotCreator,
  profile: CrmCreatorProfile
): ClientReviewSourceSnapshotCreator {
  if (profile.accounts.length === 0 && !profile.avatarUrl) return base;
  const { performance: _stalePerformance, ...rest } = base;
  if (profile.accounts.length === 0) {
    return {
      ...rest,
      avatarUrl: preferAvatarUrl(rest.avatarUrl, profile.avatarUrl) ?? profile.avatarUrl,
    };
  }
  const primary =
    profile.accounts.find((row) => canonicalPlatformKey(row.platform) === "instagram") ??
    profile.accounts[0];
  return {
    ...rest,
    platformAccounts: profile.accounts,
    platform: profile.accounts.map((row) => row.platform).join(","),
    followers: primary?.followers ?? rest.followers,
    engagementRate: primary?.engagementRate ?? rest.engagementRate,
    avgLikes: primary?.avgLikes ?? rest.avgLikes,
    avgComments: primary?.avgComments ?? rest.avgComments,
    avgViews: primary?.avgViews ?? rest.avgViews,
    handle: primary?.handle ?? rest.handle,
    avatarUrl: preferAvatarUrl(rest.avatarUrl, profile.avatarUrl) ?? profile.avatarUrl,
    profileUrl:
      rest.profileUrl ||
      primary?.profileUrl ||
      profileUrlFromHandle(primary?.handle ?? rest.handle, primary?.platform ?? rest.platform),
  };
}

export function creatorProfileSyncFingerprint(
  creators: ClientReviewSourceSnapshotCreator[]
): string {
  return JSON.stringify(
    [...creators]
      .sort((a, b) => a.creatorId.localeCompare(b.creatorId))
      .map((creator) => ({
        id: creator.creatorId,
        avatar: creator.avatarUrl ?? "",
        accounts: (creator.platformAccounts ?? []).map((row) => [
          canonicalPlatformKey(row.platform),
          row.handle ?? "",
          row.followers ?? null,
          row.engagementRate ?? null,
          row.avgLikes ?? null,
          row.avgComments ?? null,
        ]),
      }))
  );
}

export async function loadCrmCreatorProfiles(
  supabase: SupabaseClient,
  influencerIds: string[]
): Promise<Map<string, CrmCreatorProfile>> {
  const ids = [...new Set(influencerIds.filter((id) => id.trim()))];
  const profiles = new Map<string, CrmCreatorProfile>();
  if (ids.length === 0) return profiles;

  const [{ data: influencers, error: influencerError }, { data: accounts, error: accountError }] =
    await Promise.all([
      supabase.from("influencers").select("id, primary_avatar_url").in("id", ids),
      supabase
        .from("influencer_platform_accounts")
        .select(
          "influencer_id, platform, handle, profile_url, follower_count, engagement_rate, avg_likes, avg_comments, avg_views, profile_picture_url"
        )
        .in("influencer_id", ids),
    ]);
  if (influencerError) throw new Error(influencerError.message);
  if (accountError) throw new Error(accountError.message);

  const picturesById = new Map<string, Array<string | null | undefined>>();
  const accountsById = new Map<string, ClientCreatorPlatformStats[]>();
  for (const row of (accounts ?? []) as Array<{
    influencer_id: string;
    platform: string | null;
    handle: string | null;
    profile_url: string | null;
    follower_count: number | string | null;
    engagement_rate: number | string | null;
    avg_likes: number | string | null;
    avg_comments: number | string | null;
    avg_views: number | string | null;
    profile_picture_url: string | null;
  }>) {
    const mapped = platformStatsFromCrmAccount(row);
    if (mapped) {
      const list = accountsById.get(row.influencer_id) ?? [];
      list.push(mapped);
      accountsById.set(row.influencer_id, list);
    }
    const pictures = picturesById.get(row.influencer_id) ?? [];
    pictures.push(row.profile_picture_url);
    picturesById.set(row.influencer_id, pictures);
  }

  for (const row of (influencers ?? []) as Array<{ id: string; primary_avatar_url: string | null }>) {
    const liveAccounts = mergePlatformStats(
      [...(accountsById.get(row.id) ?? [])].sort(
        (a, b) => (a.followers ?? 0) - (b.followers ?? 0)
      )
    );
    profiles.set(row.id, {
      avatarUrl: bestCrmAvatarUrl(row.primary_avatar_url, picturesById.get(row.id)),
      accounts: liveAccounts,
    });
  }

  for (const [influencerId, liveAccounts] of accountsById) {
    if (profiles.has(influencerId)) continue;
    profiles.set(influencerId, {
      avatarUrl: bestCrmAvatarUrl(null, picturesById.get(influencerId)),
      accounts: mergePlatformStats(
        [...liveAccounts].sort((a, b) => (a.followers ?? 0) - (b.followers ?? 0))
      ),
    });
  }

  return profiles;
}

export async function hydrateSnapshotCreatorsFromCrm(
  supabase: SupabaseClient,
  snapshot: ClientReviewSourceSnapshot
): Promise<ClientReviewSourceSnapshot> {
  if (snapshot.creators.length === 0) return snapshot;
  const ids = snapshot.creators
    .map((creator) =>
      influencerIdFromRefs({ influencerId: creator.influencerId, creatorId: creator.creatorId })
    )
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) return snapshot;
  const profiles = await loadCrmCreatorProfiles(supabase, ids);
  if (profiles.size === 0) return snapshot;
  return {
    ...snapshot,
    creators: snapshot.creators.map((creator) => {
      const influencerId = influencerIdFromRefs({
        influencerId: creator.influencerId,
        creatorId: creator.creatorId,
      });
      if (!influencerId) return creator;
      const profile = profiles.get(influencerId);
      return profile ? applyCrmCreatorProfile(creator, profile) : creator;
    }),
  };
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
  const liveCategories = resolveDiscoveryCreatorDisplayCategories(creator);
  const categories =
    liveCategories.length > 0
      ? liveCategories
      : [
          ...new Set(
            [...(base.categories ?? []), ...creator.categories, creator.ai_category ?? ""].filter(Boolean)
          ),
        ];
  const handle =
    (platform?.handle
      ? platform.handle.startsWith("@")
        ? platform.handle
        : `@${platform.handle}`
      : undefined) || base.handle;
  return {
    ...base,
    displayName: pickCreatorDisplayName([creator.display_name, base.displayName], handle) || "Creator",
    handle,
    platform: base.platform || platform?.platform,
    platformAccounts: mergePlatformStats(
      fallbackPlatformStats(base),
      base.platformAccounts,
      platformStatsFromUnified(creator)
    ),
    followers,
    engagementRate,
    country: creator.estimated_country || creator.country_code || base.country || undefined,
    city: creator.city || base.city || undefined,
    category: liveCategories[0] || creator.ai_category || categories[0] || undefined,
    niche: creator.ai_niche || base.niche || undefined,
    categories: categories.length > 0 ? categories : undefined,
    contentCategories:
      liveCategories.length > 0
        ? liveCategories.map((label) => ({ label }))
        : base.contentCategories,
    audienceHighlight:
      creator.audience_interests?.slice(0, 3).join(" · ") || base.audienceHighlight || undefined,
    avatarUrl: preferAvatarUrl(
      base.avatarUrl,
      creator.primaryAvatarUrl || creator.profile_image_url
    ),
    profileUrl:
      platform?.profile_url ||
      base.profileUrl ||
      profileUrlFromHandle(handle, platform?.platform || base.platform),
    bio: creator.bio || base.bio || undefined,
    avgLikes:
      optionalMetric(platform?.avg_likes) ??
      optionalMetric(creator.metrics.avg_likes.value) ??
      base.avgLikes,
    avgComments:
      optionalMetric(platform?.avg_comments) ??
      optionalMetric(creator.metrics.avg_comments.value) ??
      base.avgComments,
    avgViews:
      optionalMetric(platform?.avg_views) ??
      optionalMetric(creator.metrics.avg_views.value) ??
      base.avgViews,
    tier: base.tier || resolveCreatorTierLabel({ followers, role: creator.role }),
    contentFeed: shouldReplaceContentFeed(base.contentFeed, contentFeed)
      ? contentFeed
      : (base.contentFeed ?? contentFeed),
    influencerId: base.influencerId || influencerIdFromRefs({ influencerId: creator.influencer_id, creatorId: creator.unified_id }),
  };
}

/** Open Client Workspace reviews should show live CRM/enrichment profile metrics. */
export function applyLiveCreatorProfile(
  base: ClientReviewSourceSnapshotCreator,
  unified: UnifiedCreatorResult | undefined
): ClientReviewSourceSnapshotCreator {
  if (!unified) return base;
  const next = enrichSnapshotCreatorFromUnified(base, unified);
  const { performance: _stalePerformance, ...rest } = next;
  const liveAccounts = platformStatsFromUnified(unified);
  return {
    ...rest,
    platformAccounts: liveAccounts.length > 0 ? liveAccounts : rest.platformAccounts,
  };
}

export async function hydrateSnapshotCreatorsFromUnified(
  supabase: SupabaseClient,
  snapshot: ClientReviewSourceSnapshot
): Promise<ClientReviewSourceSnapshot> {
  if (snapshot.creators.length === 0) return snapshot;
  const lookup = await resolveUnifiedCreatorsByRefs(
    supabase as never,
    {
      unifiedIds: snapshot.creators.map((creator) => creator.unifiedId ?? creator.creatorId),
      influencerIds: snapshot.creators.map(
        (creator) => creator.influencerId ?? influencerIdFromRefs({ creatorId: creator.creatorId })
      ),
      discoveredProfileIds: snapshot.creators.map((creator) => {
        if (creator.profileId?.trim()) return creator.profileId;
        return creator.creatorId.startsWith("dis:") ? creator.creatorId.slice(4) : undefined;
      }),
    },
    { omitHeavyFields: false }
  );
  return {
    ...snapshot,
    creators: snapshot.creators.map((creator) => {
      const unified = resolveCreatorFromRefLookup(lookup, {
        unified_id: creator.unifiedId ?? creator.creatorId,
        influencer_id:
          creator.influencerId ?? influencerIdFromRefs({ creatorId: creator.creatorId }) ?? null,
        profile_id:
          creator.profileId ??
          (creator.creatorId.startsWith("dis:") ? creator.creatorId.slice(4) : null),
      });
      return applyLiveCreatorProfile(creator, unified ?? undefined);
    }),
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
