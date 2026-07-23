/**
 * Group Apify actor dataset rows into per-creator bundles for stored-payload import.
 * Shared by CLI import script and dataset acquisition orchestrator.
 */

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

export function normalizeApifyHandle(value: string): string {
  return value.replace(/^@+/, "").trim().toLowerCase();
}

export function extractHandleFromApifyRow(row: Record<string, unknown>): string | null {
  const authorMeta =
    row.authorMeta && typeof row.authorMeta === "object" && !Array.isArray(row.authorMeta)
      ? (row.authorMeta as Record<string, unknown>)
      : null;

  for (const candidate of [
    str(row.username),
    str(row.userName),
    str(row.ownerUsername),
    str(row.owner),
    authorMeta ? str(authorMeta.name) : null,
    authorMeta ? str(authorMeta.nickName) : null,
  ]) {
    if (candidate) return normalizeApifyHandle(candidate);
  }
  return null;
}

export function isApifyProfileDetailRow(row: Record<string, unknown>): boolean {
  const authorMeta =
    row.authorMeta && typeof row.authorMeta === "object" && !Array.isArray(row.authorMeta)
      ? (row.authorMeta as Record<string, unknown>)
      : null;

  // Snapchat (automation-lab/snapchat-scraper) uses subscriberCount + profileType.
  return (
    row.followersCount != null ||
    row.followerCount != null ||
    row.subscriberCount != null ||
    row.subscribers != null ||
    row.biography != null ||
    row.bio != null ||
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
  const latestPosts = row.latestPosts;
  if (!Array.isArray(latestPosts)) return [];
  return latestPosts.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item)
  );
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
