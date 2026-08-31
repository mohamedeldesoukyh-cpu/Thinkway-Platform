/**
 * Group Apify actor dataset rows into per-creator bundles for stored-payload import.
 * Shared by CLI import script and dataset acquisition orchestrator.
 */

import { parseProfileInput } from "@/lib/social/parse-profile-url";
import { buildCanonicalProfileUrl, type SocialPlatform } from "@/lib/social/platforms";

export type ApifyCreatorBundle = {
  username: string;
  profileUrl: string;
  profileRows: Record<string, unknown>[];
  postRows: Record<string, unknown>[];
};

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

export function normalizeApifyHandle(value: string): string {
  return value.replace(/^@+/, "").trim().toLowerCase();
}

function handleFromProfileUrl(url: string | null): string | null {
  if (!url) return null;
  const parsed = parseProfileInput(url);
  const username = parsed?.username?.trim();
  return username ? normalizeApifyHandle(username) : null;
}

export function extractHandleFromApifyRow(row: Record<string, unknown>): string | null {
  const authorMeta = record(row.authorMeta);
  const channel = record(row.channel);

  for (const candidate of [
    str(row.username),
    str(row.userName),
    str(row.ownerUsername),
    str(row.channelUsername),
    str(row.pageName),
    typeof row.owner === "string" ? str(row.owner) : null,
    authorMeta ? str(authorMeta.name) : null,
    authorMeta ? str(authorMeta.uniqueId) : null,
    authorMeta ? str(authorMeta.nickName) : null,
  ]) {
    if (candidate) return normalizeApifyHandle(candidate);
  }

  // YouTube videos expose the channel URL, not username. Facebook pages use pageUrl.
  for (const urlCandidate of [
    str(row.channelUrl),
    str(row.inputChannelUrl),
    str(row.fromYTUrl),
    str(row.pageUrl),
    str(row.facebookUrl),
    str(row.profileUrl),
    channel ? str(channel.url) : null,
    str(row.url),
  ]) {
    const fromUrl = handleFromProfileUrl(urlCandidate);
    if (fromUrl) return fromUrl;
  }

  return null;
}

export function isApifyProfileDetailRow(row: Record<string, unknown>): boolean {
  const authorMeta = record(row.authorMeta);

  // Snapchat uses subscriberCount + profileType. Facebook pages scraper uses `followers`.
  // Do not treat YouTube `numberOfSubscribers` as profile details — that field is copied
  // onto every video row from streamers/youtube-scraper.
  return (
    row.followersCount != null ||
    row.followerCount != null ||
    row.followers != null ||
    row.subscriberCount != null ||
    row.subscribers != null ||
    row.biography != null ||
    row.bio != null ||
    row.intro != null ||
    row.fullName != null ||
    row.displayName != null ||
    row.profileType != null ||
    row.fans != null ||
    authorMeta?.fans != null ||
    authorMeta?.followerCount != null ||
    authorMeta?.subscriberCount != null
  );
}

function extractEmbeddedPosts(row: Record<string, unknown>): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const key of ["latestPosts", "latestIgtvVideos", "posts", "pagePosts", "reels"] as const) {
    const value = row[key];
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        rows.push(item as Record<string, unknown>);
      }
    }
  }
  return rows;
}

/** Partition a flat Apify dataset into creator-scoped profile + post row bundles. */
export function groupApifyRowsIntoCreators(
  rows: Record<string, unknown>[],
  platform: SocialPlatform
): ApifyCreatorBundle[] {
  const grouped = new Map<
    string,
    { profileRows: Record<string, unknown>[]; postRows: Record<string, unknown>[] }
  >();

  for (const row of rows) {
    const handle = extractHandleFromApifyRow(row);
    if (!handle) continue;

    const bucket = grouped.get(handle) ?? { profileRows: [], postRows: [] };

    if (isApifyProfileDetailRow(row)) {
      bucket.profileRows.push(row);
      bucket.postRows.push(...extractEmbeddedPosts(row));
    } else {
      bucket.postRows.push(row);
    }

    grouped.set(handle, bucket);
  }

  return [...grouped.entries()].map(([username, bucket]) => ({
    username,
    profileUrl: buildCanonicalProfileUrl(platform, username),
    profileRows: bucket.profileRows,
    postRows: bucket.postRows,
  }));
}
