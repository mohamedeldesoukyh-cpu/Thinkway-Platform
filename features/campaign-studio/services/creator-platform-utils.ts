import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { resolveBrowseCreatorProfileImageUrl } from "@/lib/performance/creator-avatar";

export type SearchCreatorCardItem = {
  id: string;
  handle: string;
  displayName: string;
  platform: string;
  followers?: number;
  engagementRate?: number;
  avatarUrl?: string;
  profileUrl?: string;
  /** Campaign relevance % from CIP criteria scoring (Discovery AI parity). */
  campaignRelevanceScore?: number;
  /** Creator content categories — drives per-creator content concepts. */
  categories?: string[];
  /** Follower tier label assigned by strategy-coherent slate composition. */
  tier?: string;
  /** Proposed content concept matched to the creator's category. */
  contentIdea?: string;
};

/** Build external profile URL from platform + handle when DB URL is missing. */
export function buildSocialProfileUrl(platform: string, handle: string): string | undefined {
  const h = handle.replace(/^@/, "").trim();
  if (!h) return undefined;
  const p = platform.toLowerCase();
  if (p.includes("tiktok")) return `https://www.tiktok.com/@${h}`;
  if (p.includes("youtube")) return `https://www.youtube.com/@${h}`;
  if (p.includes("twitter") || p === "x") return `https://x.com/${h}`;
  if (p.includes("snapchat")) return `https://www.snapchat.com/add/${h}`;
  return `https://www.instagram.com/${h}`;
}

function normalizePlatformName(raw: string): string {
  const p = raw.toLowerCase().trim();
  if (p.includes("tiktok") || p === "tt") return "tiktok";
  if (p.includes("instagram") || p === "ig") return "instagram";
  if (p.includes("youtube") || p === "yt") return "youtube";
  return p;
}

/** Prefer brief/CIP platform, else highest-follower account. */
export function resolvePrimaryPlatformAccount(
  creator: UnifiedCreatorResult,
  preferredPlatforms?: string[]
): UnifiedCreatorResult["platforms"][number] | undefined {
  const platforms = creator.platforms ?? [];
  if (platforms.length === 0) return undefined;

  const prefs = (preferredPlatforms ?? []).map(normalizePlatformName).filter(Boolean);
  if (prefs.length > 0) {
    for (const pref of prefs) {
      const match = platforms.find((p) => normalizePlatformName(p.platform) === pref);
      if (match) return match;
    }
  }

  return [...platforms].sort(
    (a, b) => (b.follower_count ?? 0) - (a.follower_count ?? 0)
  )[0];
}

export function resolvePrimaryPlatformLabel(
  creator: UnifiedCreatorResult,
  preferredPlatforms?: string[]
): string {
  return resolvePrimaryPlatformAccount(creator, preferredPlatforms)?.platform ?? "instagram";
}

export function parsePlatformFromRecommendationLine(line: string): string | undefined {
  const paren = line.match(/\((IG|TT|YT|TikTok|Instagram|YouTube)\)/i);
  if (!paren) return undefined;
  const token = paren[1].toLowerCase();
  if (token === "ig" || token.includes("insta")) return "instagram";
  if (token === "tt" || token.includes("tik")) return "tiktok";
  if (token === "yt" || token.includes("you")) return "youtube";
  return undefined;
}

/** Map unified browse row to searchCreators tool / action-card shape. */
export function mapBrowseCreatorToSearchResult(
  creator: UnifiedCreatorResult,
  preferredPlatforms?: string[]
): SearchCreatorCardItem {
  const account = resolvePrimaryPlatformAccount(creator, preferredPlatforms);
  const platform = account?.platform ?? "instagram";
  const rawHandle = account?.handle?.replace(/^@/, "").trim() ?? "";
  const handle = rawHandle || creator.display_name?.replace(/\s+/g, "").toLowerCase() || "creator";
  const displayName = creator.display_name ?? handle;

  const profileUrl =
    account?.profile_url?.trim() || buildSocialProfileUrl(platform, handle);

  const avatarUrl =
    creator.primaryAvatarUrl?.trim() ||
    creator.profile_image_url?.trim() ||
    resolveBrowseCreatorProfileImageUrl({
      platform: account?.platform,
      platformPictureUrl: account?.profile_picture_url,
      influencerAvatarUrl: creator.profile_image_url,
      discoveryProfileImageUrl: null,
    }) ||
    undefined;

  return {
    id: creator.unified_id,
    handle,
    displayName,
    platform,
    followers: (() => {
      const candidates = [
        account?.follower_count,
        creator.metrics?.followers?.value,
        ...(creator.platforms ?? []).map((platform) => platform.follower_count),
      ].filter((value): value is number => typeof value === "number" && value > 0);
      return candidates.length > 0 ? Math.max(...candidates) : undefined;
    })(),
    engagementRate:
      account?.engagement_rate ?? creator.metrics?.engagement_rate?.value ?? undefined,
    avatarUrl: avatarUrl || undefined,
    profileUrl: profileUrl || undefined,
    campaignRelevanceScore: creator.campaign_relevance_score ?? undefined,
    categories: [
      ...(creator.browse_category_tags ?? []),
      ...creator.categories,
      ...(creator.ai_category ? [creator.ai_category] : []),
      ...(creator.ai_niche ? [creator.ai_niche] : []),
    ].filter(Boolean),
  };
}
