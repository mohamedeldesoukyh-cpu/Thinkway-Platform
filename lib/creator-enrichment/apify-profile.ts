/**
 * Apify PROFILE fetch for creator enrichment.
 *
 * Reuses the existing Apify contract — token + per-platform actor ids from
 * {@link getMetricsCollectorEnv} / {@link apifyActorIdForPlatform}. Actor runs
 * use the `/runs?waitForFinish` API so we persist a real `apifyRunId`.
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

type ApifyActorRunResult = {
  runId: string | null;
  rows: Record<string, unknown>[];
  error?: string;
};

function logApifyEnrichment(event: string, data: Record<string, unknown>): void {
  console.log(`[creator-enrichment:apify] ${event}`, JSON.stringify(data));
}

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

function normalizeHandle(username: string | null, profileUrl: string): string | null {
  const fromUsername = username?.replace(/^@/, "").trim();
  if (fromUsername) return fromUsername;
  try {
    const path = new URL(profileUrl).pathname.replace(/^\/+|\/+$/g, "");
    const segment = path.split("/").filter(Boolean)[0];
    return segment ? segment.replace(/^@/, "") : null;
  } catch {
    return null;
  }
}

function isApifyErrorRow(row: Record<string, unknown>): boolean {
  return typeof row.error === "string" && row.error.length > 0;
}

function filterUsableRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.filter((row) => !isApifyErrorRow(row));
}

function apifyErrorReason(rows: Record<string, unknown>[]): string | null {
  const errorRow = rows.find(isApifyErrorRow);
  if (!errorRow) return null;
  const description = str(errorRow.errorDescription);
  return description ?? str(errorRow.error) ?? "Apify returned an error item.";
}

/**
 * Profile-oriented actor input. Instagram uses `searchType: user` + `resultsType:
 * details` (the scraper does NOT accept `usernames`). TikTok profile scrapers
 * accept a handle list; generic platforms fall back to a direct profile URL.
 */
function buildProfileDetailsInput(
  platformKey: string,
  username: string | null,
  profileUrl: string
): Record<string, unknown> {
  const handle = normalizeHandle(username, profileUrl);
  switch (platformKey) {
    case "instagram":
      return handle
        ? {
            search: handle,
            searchType: "user",
            resultsType: "details",
            resultsLimit: 1,
          }
        : { directUrls: [profileUrl], resultsType: "details", resultsLimit: 1 };
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

/** Latest-post scrape input (Instagram only — combined with profile details). */
function buildProfilePostsInput(platformKey: string, profileUrl: string): Record<string, unknown> | null {
  if (platformKey !== "instagram") return null;
  return { directUrls: [profileUrl], resultsType: "posts", resultsLimit: 6 };
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
  return rows
    .slice(0, 6)
    .map((row) => ({
      url: str(row.url) ?? str(row.postPage) ?? str(row.webVideoUrl) ?? null,
      thumbnail: str(row.displayUrl) ?? str(row.thumbnailUrl) ?? str(row.coverUrl) ?? null,
      likes: num(row.likesCount) ?? num(row.diggCount) ?? num(row.likes),
      comments: num(row.commentsCount) ?? num(row.comments),
      views: num(row.videoViewCount) ?? num(row.playCount) ?? num(row.views),
      posted_at: str(row.timestamp) ?? str(row.createTimeISO) ?? null,
      caption: str(row.caption) ?? str(row.text) ?? null,
    }))
    .filter((pub) => pub.url || pub.caption || pub.likes != null || pub.comments != null);
}

function averageOf(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length === 0) return null;
  return Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2));
}

async function launchApifyActor(input: {
  actorId: string;
  token: string;
  body: Record<string, unknown>;
  platformKey: string;
  timeoutMs: number;
  label: string;
}): Promise<ApifyActorRunResult> {
  logApifyEnrichment("Launching actor", {
    label: input.label,
    actorId: input.actorId,
    platform: input.platformKey,
    actorInput: input.body,
  });

  const waitSeconds = Math.max(1, Math.ceil(input.timeoutMs / 1000));
  const response = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(input.actorId)}/runs?token=${encodeURIComponent(input.token)}&waitForFinish=${waitSeconds}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input.body),
      signal: AbortSignal.timeout(input.timeoutMs + 5_000),
    }
  );

  if (!response.ok) {
    return { runId: null, rows: [], error: `Apify HTTP ${response.status}` };
  }

  const payload = (await response.json()) as {
    data?: { id?: string; defaultDatasetId?: string; status?: string };
  };
  const runId = str(payload.data?.id);
  logApifyEnrichment("Actor run finished", {
    label: input.label,
    apifyRunId: runId,
    status: payload.data?.status ?? null,
  });

  const datasetId = str(payload.data?.defaultDatasetId);
  if (!datasetId) {
    return { runId, rows: [], error: "Apify run returned no dataset." };
  }

  const itemsResponse = await fetch(
    `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?token=${encodeURIComponent(input.token)}`,
    { signal: AbortSignal.timeout(30_000) }
  );
  if (!itemsResponse.ok) {
    return { runId, rows: [], error: `Apify dataset HTTP ${itemsResponse.status}` };
  }

  const items = (await itemsResponse.json()) as unknown[];
  const rows = (items ?? []).map(record).filter((r): r is Record<string, unknown> => r != null);
  logApifyEnrichment("Actor raw output", {
    label: input.label,
    apifyRunId: runId,
    rawOutputCount: rows.length,
  });

  const errorReason = apifyErrorReason(rows);
  if (errorReason && filterUsableRows(rows).length === 0) {
    return { runId, rows: [], error: errorReason };
  }

  return { runId, rows: filterUsableRows(rows) };
}

function normalizeApifyProfileData(input: {
  platformKey: string;
  username: string | null;
  profileUrl: string;
  profileRows: Record<string, unknown>[];
  postRows: Record<string, unknown>[];
  apifyRunId: string | null;
}): ApifyProfileData | null {
  const metricRows =
    input.profileRows.length > 0 ? input.profileRows : input.postRows;
  if (metricRows.length === 0) return null;

  const head = input.profileRows[0] ?? metricRows[0];
  const owner = record(head.owner) ?? record(head.author) ?? record(head.authorMeta) ?? head;
  const publicationRows =
    input.postRows.length > 0
      ? input.postRows
      : input.platformKey === "instagram"
        ? []
        : metricRows;

  const followers =
    num(head.followersCount) ??
    num(owner.followersCount) ??
    num(owner.fans) ??
    pickApifyAuthorFollowerCount(input.platformKey, head);
  const following = num(head.followsCount) ?? num(owner.following) ?? num(owner.followingCount);
  const postsCount =
    num(head.postsCount) ?? num(owner.postsCount) ?? num(owner.videoCount) ?? null;

  const recent = toRecentPublications(publicationRows);
  const avgLikes = averageOf(recent.map((p) => p.likes));
  const avgComments = averageOf(recent.map((p) => p.comments));
  const avgViews = averageOf(recent.map((p) => p.views));
  const engagementRate =
    followers && followers > 0 && (avgLikes != null || avgComments != null)
      ? Number((((avgLikes ?? 0) + (avgComments ?? 0)) / followers * 100).toFixed(3))
      : null;

  return {
    platform: input.platformKey,
    username:
      input.username ??
      normalizeHandle(null, input.profileUrl) ??
      str(head.username) ??
      str(owner.userName) ??
      str(owner.name),
    displayName: str(head.fullName) ?? str(owner.nickName) ?? str(owner.fullName),
    bio: str(head.biography) ?? str(owner.signature) ?? str(head.description),
    profilePictureUrl: pickApifyAuthorAvatarUrl(input.platformKey, head) ?? str(head.profilePicUrl),
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
    hashtags: extractHashtags(publicationRows),
    mentions: extractMentions(publicationRows),
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
    apifyRunId: input.apifyRunId,
  };
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
  const hasApifyToken = Boolean(env.apifyToken);
  const platformKey = canonicalPlatformKey(input.platform);
  const handle = normalizeHandle(input.username, input.profileUrl);

  logApifyEnrichment("Preflight", {
    hasApifyToken,
    platform: platformKey,
    username: handle,
    profileUrl: input.profileUrl,
  });

  if (!env.apifyToken) {
    logApifyEnrichment("Skipped Apify", {
      fallbackReason: "APIFY_TOKEN not configured.",
    });
    return { ok: false, available: false, reason: "APIFY_TOKEN not configured." };
  }

  const actorId = apifyActorIdForPlatform(platformKey, env);
  logApifyEnrichment("Actor selected", {
    platform: platformKey,
    actorId,
  });

  if (!actorId) {
    logApifyEnrichment("Skipped Apify", {
      fallbackReason: "Apify actor id not configured.",
      platform: platformKey,
    });
    return { ok: false, available: false, reason: "Apify actor id not configured." };
  }

  const timeoutMs = input.timeoutMs ?? 120_000;
  const detailsInput = buildProfileDetailsInput(platformKey, input.username, input.profileUrl);
  const postsInput = buildProfilePostsInput(platformKey, input.profileUrl);

  try {
    const detailsRun = await launchApifyActor({
      actorId,
      token: env.apifyToken,
      body: detailsInput,
      platformKey,
      timeoutMs,
      label: "profile-details",
    });

    if (detailsRun.error && detailsRun.rows.length === 0) {
      logApifyEnrichment("Apify profile fetch failed", {
        platform: platformKey,
        fallbackReason: detailsRun.error,
        apifyRunId: detailsRun.runId,
      });
      return { ok: false, available: true, reason: detailsRun.error };
    }

    let postRows: Record<string, unknown>[] = [];
    let apifyRunId = detailsRun.runId;

    if (postsInput) {
      const postsRun = await launchApifyActor({
        actorId,
        token: env.apifyToken,
        body: postsInput,
        platformKey,
        timeoutMs,
        label: "profile-posts",
      });
      if (postsRun.error && postsRun.rows.length === 0) {
        logApifyEnrichment("Apify posts fetch failed", {
          platform: platformKey,
          fallbackReason: postsRun.error,
          apifyRunId: postsRun.runId,
        });
      } else {
        postRows = postsRun.rows;
        apifyRunId = postsRun.runId ?? apifyRunId;
      }
    }

    const data = normalizeApifyProfileData({
      platformKey,
      username: input.username,
      profileUrl: input.profileUrl,
      profileRows: detailsRun.rows,
      postRows,
      apifyRunId,
    });

    if (!data) {
      logApifyEnrichment("Apify normalization empty", {
        platform: platformKey,
        fallbackReason: "Apify returned no usable items.",
        apifyRunId,
      });
      return { ok: false, available: true, reason: "Apify returned no usable items." };
    }

    logApifyEnrichment("Normalization output", {
      platform: platformKey,
      apifyRunId: data.apifyRunId,
      followers: data.followers,
      engagementRate: data.engagementRate,
      recentPublications: data.recentPublications.length,
      displayName: data.displayName,
    });

    return { ok: true, data };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Apify request failed.";
    logApifyEnrichment("Apify request threw", {
      platform: platformKey,
      fallbackReason: reason,
    });
    return { ok: false, available: true, reason };
  }
}
