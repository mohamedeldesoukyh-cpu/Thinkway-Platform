/**
 * Apify PROFILE fetch for creator enrichment.
 *
 * Reuses the existing Apify contract — token + per-platform actor ids from
 * {@link getMetricsCollectorEnv} / {@link apifyActorIdForPlatform} and the same
 * `run-sync-get-dataset-items` endpoint used by the publication metrics provider.
 * We do NOT duplicate Apify client/token setup; this module only adds the
 * profile-oriented input + a defensive field mapper.
 *
 * "Never invent": every field falls back to null when the actor omits it.
 */

import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { getMetricsCollectorEnv } from "@/lib/performance/metrics-collector/config";
import { apifyActorIdForPlatform } from "@/lib/performance/metrics-collector/providers/apify-input";
import { pickApifyAuthorAvatarUrl } from "@/lib/performance/apify-author-avatar";
import { pickApifyAuthorFollowerCount } from "@/lib/performance/apify-author-followers";

import type { ApifyProfileData, RecentPublication } from "./types";

export type ApifyProfileFetchResult =
  | { ok: true; data: ApifyProfileData }
  | { ok: false; reason: string; available: boolean };

function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "string" ? Number(value.replace(/[, ]/g, "")) : Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Profile-oriented actor input. Instagram/TikTok profile scrapers accept a
 * username/handle list; generic platforms fall back to a direct profile URL.
 */
function buildProfileInput(
  platformKey: string,
  username: string | null,
  profileUrl: string
): Record<string, unknown> {
  const handle = username?.replace(/^@/, "") ?? null;
  switch (platformKey) {
    case "instagram":
      return handle
        ? { usernames: [handle], resultsLimit: 6 }
        : { directUrls: [profileUrl], resultsLimit: 6 };
    case "tiktok":
      return handle
        ? { profiles: [handle], resultsPerPage: 6, shouldDownloadVideos: false }
        : { postURLs: [profileUrl], resultsPerPage: 6 };
    case "youtube":
      return { startUrls: [{ url: profileUrl }], maxResults: 6 };
    default:
      return { directUrls: [profileUrl], resultsLimit: 6 };
  }
}

function extractHashtags(rows: Record<string, unknown>[]): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const caption = str(row.caption) ?? str(row.text) ?? "";
    for (const match of caption.matchAll(/#([\p{L}0-9_]+)/gu)) {
      if (match[1]) set.add(`#${match[1]}`);
    }
    if (Array.isArray(row.hashtags)) {
      for (const tag of row.hashtags) {
        const t = str(tag);
        if (t) set.add(t.startsWith("#") ? t : `#${t}`);
      }
    }
  }
  return [...set].slice(0, 30);
}

function extractMentions(rows: Record<string, unknown>[]): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const caption = str(row.caption) ?? str(row.text) ?? "";
    for (const match of caption.matchAll(/@([\p{L}0-9_.]+)/gu)) {
      if (match[1]) set.add(`@${match[1]}`);
    }
  }
  return [...set].slice(0, 30);
}

function toRecentPublications(rows: Record<string, unknown>[]): RecentPublication[] {
  return rows.slice(0, 6).map((row) => ({
    url: str(row.url) ?? str(row.postPage) ?? str(row.webVideoUrl) ?? null,
    thumbnail: str(row.displayUrl) ?? str(row.thumbnailUrl) ?? str(row.coverUrl) ?? null,
    likes: num(row.likesCount) ?? num(row.diggCount) ?? num(row.likes),
    comments: num(row.commentsCount) ?? num(row.comments),
    views: num(row.videoViewCount) ?? num(row.playCount) ?? num(row.views),
    posted_at: str(row.timestamp) ?? str(row.createTimeISO) ?? null,
    caption: str(row.caption) ?? str(row.text) ?? null,
  }));
}

function averageOf(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length === 0) return null;
  return Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2));
}

/**
 * Fetch + normalize a creator profile from Apify. Best-effort and resilient to
 * actor schema differences. Returns `available: false` only when Apify is not
 * configured, so callers can distinguish "no credentials" from "no data".
 */
export async function fetchApifyProfile(input: {
  platform: string;
  username: string | null;
  profileUrl: string;
  timeoutMs?: number;
}): Promise<ApifyProfileFetchResult> {
  const env = getMetricsCollectorEnv();
  if (!env.apifyToken) {
    return { ok: false, available: false, reason: "APIFY_TOKEN not configured." };
  }

  const platformKey = canonicalPlatformKey(input.platform);
  const actorId = apifyActorIdForPlatform(platformKey, env);
  if (!actorId) {
    return { ok: false, available: false, reason: "Apify actor id not configured." };
  }

  const body = buildProfileInput(platformKey, input.username, input.profileUrl);

  let items: unknown[];
  try {
    const response = await fetch(
      `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${env.apifyToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(input.timeoutMs ?? 120_000),
      }
    );
    if (!response.ok) {
      return { ok: false, available: true, reason: `Apify HTTP ${response.status}` };
    }
    items = (await response.json()) as unknown[];
  } catch (error) {
    return {
      ok: false,
      available: true,
      reason: error instanceof Error ? error.message : "Apify request failed.",
    };
  }

  const rows = (items ?? []).map(record).filter((r): r is Record<string, unknown> => r != null);
  if (rows.length === 0) {
    return { ok: false, available: true, reason: "Apify returned no items." };
  }

  // First row may be the profile (profile scrapers) or a post (post scrapers).
  const head = rows[0];
  const owner = record(head.owner) ?? record(head.author) ?? record(head.authorMeta) ?? head;

  const followers =
    num(head.followersCount) ??
    num(owner.followersCount) ??
    num(owner.fans) ??
    pickApifyAuthorFollowerCount(platformKey, head);
  const following = num(head.followsCount) ?? num(owner.following) ?? num(owner.followingCount);
  const postsCount =
    num(head.postsCount) ?? num(owner.postsCount) ?? num(owner.videoCount) ?? null;

  const recent = toRecentPublications(rows);
  const avgLikes = averageOf(recent.map((p) => p.likes));
  const avgComments = averageOf(recent.map((p) => p.comments));
  const avgViews = averageOf(recent.map((p) => p.views));
  const engagementRate =
    followers && followers > 0 && (avgLikes != null || avgComments != null)
      ? Number((((avgLikes ?? 0) + (avgComments ?? 0)) / followers * 100).toFixed(3))
      : null;

  const data: ApifyProfileData = {
    platform: platformKey,
    username:
      input.username ?? str(head.username) ?? str(owner.userName) ?? str(owner.name),
    displayName: str(head.fullName) ?? str(owner.nickName) ?? str(owner.fullName),
    bio: str(head.biography) ?? str(owner.signature) ?? str(head.description),
    profilePictureUrl: pickApifyAuthorAvatarUrl(platformKey, head) ?? str(head.profilePicUrl),
    profileUrl: input.profileUrl,
    followers,
    following,
    postsCount,
    avgViews,
    avgLikes,
    avgComments,
    engagementRate,
    isVerified:
      typeof head.verified === "boolean"
        ? head.verified
        : typeof owner.verified === "boolean"
          ? owner.verified
          : null,
    audienceCountry: str(head.country) ?? null,
    hashtags: extractHashtags(rows),
    mentions: extractMentions(rows),
    categories: (() => {
      const c = str(head.businessCategoryName) ?? str(head.category);
      return c ? [c] : [];
    })(),
    recentPublications: recent,
    contactEmail: str(head.publicEmail) ?? str(head.email),
    contactPhone: str(head.publicPhoneNumber) ?? null,
    contactLinks: (() => {
      const link = str(head.externalUrl) ?? str(head.website);
      return link ? [link] : [];
    })(),
    apifyRunId: str(head.__apifyRunId) ?? null,
  };

  return { ok: true, data };
}
