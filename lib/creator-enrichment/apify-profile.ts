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
import {
  apifyProfileActorIdForPlatform,
  buildApifyProfileDetailsInput,
} from "@/lib/performance/metrics-collector/providers/apify-input";
import { pickApifyAuthorAvatarUrl } from "@/lib/performance/apify-author-avatar";
import { pickApifyAuthorFollowerCount } from "@/lib/performance/apify-author-followers";
import { isAvatarUrlAllowedForPlatform } from "@/lib/performance/creator-avatar";
import { isUsableAvatarUrl } from "@/lib/performance/avatar-sync-policy";

import {
  isCreatorRecentPublicationVideo,
  resolveCreatorRecentPublicationThumbnail,
} from "@/lib/creators/recent-publication-thumb";
import { formatCreatorBio } from "@/lib/text/decode-html-entities";
import { extractEmailFromText, normalizeContactLinks } from "@/lib/creators/contact-info";

import { isCreatorEnrichmentWorkerEnabled } from "./enabled";
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
 * Profile-oriented actor input. Instagram profile metadata must be scraped via
 * `directUrls` + `resultsType: details` — username search (`searchType: user`)
 * often returns `no_items` for exact public handles. TikTok profile scrapers
 * accept a handle list; generic platforms fall back to a direct profile URL.
 */
function buildProfileDetailsInput(
  platformKey: string,
  username: string | null,
  profileUrl: string
): Record<string, unknown> {
  return buildApifyProfileDetailsInput(platformKey, profileUrl, username);
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
        const fromObject =
          tag && typeof tag === "object" && !Array.isArray(tag)
            ? str((tag as { name?: unknown }).name)
            : null;
        const t = fromObject ?? str(tag);
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

function extractLatestPostRows(head: Record<string, unknown>): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const key of ["latestPosts", "latestIgtvVideos"] as const) {
    const value = head[key];
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      if (item && typeof item === "object") {
        rows.push(item as Record<string, unknown>);
      }
    }
  }
  return rows;
}

function toRecentPublications(rows: Record<string, unknown>[]): RecentPublication[] {
  return rows
    .slice(0, 6)
    .map((row) => ({
      url: str(row.url) ?? str(row.postPage) ?? str(row.webVideoUrl) ?? null,
      thumbnail: resolveCreatorRecentPublicationThumbnail(row),
      likes: num(row.likesCount) ?? num(row.diggCount) ?? num(row.likes),
      comments: num(row.commentsCount) ?? num(row.comments),
      views: num(row.videoViewCount) ?? num(row.playCount) ?? num(row.views),
      posted_at: str(row.timestamp) ?? str(row.createTimeISO) ?? null,
      caption: str(row.caption) ?? str(row.text) ?? null,
      isVideo: isCreatorRecentPublicationVideo(row),
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
  const sampleRow = rows[0];
  logApifyEnrichment("Actor raw output", {
    label: input.label,
    apifyRunId: runId,
    rawOutputCount: rows.length,
    rawOutputSample: sampleRow
      ? {
          keys: Object.keys(sampleRow).slice(0, 25),
          error: sampleRow.error ?? null,
          errorDescription: sampleRow.errorDescription ?? null,
          username: sampleRow.username ?? null,
          followersCount: sampleRow.followersCount ?? null,
        }
      : null,
  });

  const errorReason = apifyErrorReason(rows);
  if (errorReason && filterUsableRows(rows).length === 0) {
    return { runId, rows: [], error: errorReason };
  }

  return { runId, rows: filterUsableRows(rows) };
}

function pickApifyProfilePictureUrl(
  platformKey: string,
  head: Record<string, unknown>,
  owner: Record<string, unknown>
): string | null {
  const candidates = [
    pickApifyAuthorAvatarUrl(platformKey, head),
    pickApifyAuthorAvatarUrl(platformKey, owner),
    str(head.profilePictureUrl),
    str(head.profilePicUrl),
    str(head.profilePicUrlHD),
    str(head.profilePicUrlHd),
    str(head.hdProfilePicUrl),
    str(head.profilePicUrl),
    str(head.avatarLarger),
    str(head.avatarMedium),
    str(head.avatar),
    str(head.originalAvatarUrl),
    str(owner.profilePicUrlHD),
    str(owner.profilePicUrlHd),
    str(owner.hdProfilePicUrl),
    str(owner.profilePicUrl),
    str(owner.avatarLarger),
    str(owner.avatarMedium),
    str(owner.avatar),
    str(owner.originalAvatarUrl),
  ];

  for (const raw of candidates) {
    const trimmed = raw?.trim();
    if (!trimmed || !isUsableAvatarUrl(trimmed)) continue;
    if (!isAvatarUrlAllowedForPlatform(platformKey, trimmed)) continue;
    return trimmed;
  }

  return null;
}

/** Scan all Apify rows — TikTok profile scrapes may omit avatar on the first post row. */
export function pickApifyProfilePictureFromRows(
  platformKey: string,
  rows: Record<string, unknown>[]
): string | null {
  for (const row of rows) {
    const owner = record(row.owner) ?? record(row.author) ?? record(row.authorMeta) ?? row;
    const picked = pickApifyProfilePictureUrl(platformKey, row, owner);
    if (picked) return picked;
  }
  return null;
}

function normalizeApifyCountryCode(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  return trimmed;
}

/** TikTok: authorMeta.region; Instagram: country on profile details. */
export function pickApifyAudienceCountry(
  platformKey: string,
  head: Record<string, unknown>,
  owner: Record<string, unknown>,
  rows: Record<string, unknown>[]
): string | null {
  const candidates: Array<string | null> = [
    str(head.country),
    str(owner.country),
    str(head.region),
    str(owner.region),
  ];

  if (platformKey === "tiktok") {
    for (const row of rows) {
      const authorMeta = record(row.authorMeta);
      if (!authorMeta) continue;
      candidates.push(str(authorMeta.region), str(authorMeta.country));
    }
  }

  for (const candidate of candidates) {
    const normalized = normalizeApifyCountryCode(candidate);
    if (normalized) return normalized;
  }

  return null;
}

/** Business category when present; TikTok falls back to top post hashtags as interest tags. */
export function pickApifyInterestCategories(
  platformKey: string,
  head: Record<string, unknown>,
  owner: Record<string, unknown>,
  hashtags: string[]
): string[] {
  const business =
    str(head.businessCategoryName) ??
    str(head.category) ??
    str(owner.businessCategoryName) ??
    str(owner.category);
  if (business) return [business];

  if (platformKey === "tiktok" && hashtags.length > 0) {
    const tags = hashtags
      .slice(0, 8)
      .map((tag) => tag.replace(/^#+/, "").trim())
      .filter(Boolean);
    return [...new Set(tags)];
  }

  return [];
}

export function normalizeApifyProfileData(input: {
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
        ? extractLatestPostRows(head)
        : metricRows;

  const followers =
    num(head.followers) ??
    num(head.followersCount) ??
    num(head.followerCount) ??
    num(owner.followers) ??
    num(owner.followersCount) ??
    num(owner.followerCount) ??
    num(owner.fans) ??
    pickApifyAuthorFollowerCount(input.platformKey, head);
  const following =
    num(head.followsCount) ??
    num(head.following) ??
    num(owner.following) ??
    num(owner.followingCount) ??
    null;
  const postsCount =
    num(head.postsCount) ??
    num(head.likes) ??
    num(owner.postsCount) ??
    num(owner.videoCount) ??
    null;

  const recent = toRecentPublications(publicationRows);
  const hashtags = extractHashtags(publicationRows);
  const avgLikes = averageOf(recent.map((p) => p.likes));
  const avgComments = averageOf(recent.map((p) => p.comments));
  const avgViews = averageOf(recent.map((p) => p.views));
  const engagementRate =
    followers && followers > 0 && (avgLikes != null || avgComments != null)
      ? Number((((avgLikes ?? 0) + (avgComments ?? 0)) / followers * 100).toFixed(3))
      : null;
  const allAvatarRows = [...input.profileRows, ...input.postRows, ...metricRows];

  const bio = formatCreatorBio(
    str(head.intro) ??
      str(head.about) ??
      str(head.biography) ??
      str(owner.signature) ??
      str(head.description)
  );

  return {
    platform: input.platformKey,
    username:
      input.username ??
      normalizeHandle(null, input.profileUrl) ??
      str(head.pageName) ??
      str(head.username) ??
      str(head.userName) ??
      str(owner.userName) ??
      str(owner.name),
    displayName:
      str(head.title) ??
      str(head.fullName) ??
      str(owner.nickName) ??
      str(owner.fullName),
    bio,
    profilePictureUrl: pickApifyProfilePictureFromRows(input.platformKey, allAvatarRows),
    profileUrl: input.profileUrl,
    followers,
    following,
    postsCount,
    avgViews: avgViews != null ? Math.round(avgViews) : null,
    avgLikes,
    avgComments,
    engagementRate,
    isVerified:
      typeof head.verified === "boolean"
        ? head.verified
        : typeof owner.verified === "boolean"
          ? owner.verified
          : null,
    audienceCountry: pickApifyAudienceCountry(
      input.platformKey,
      head,
      owner,
      allAvatarRows
    ),
    hashtags,
    mentions: extractMentions(publicationRows),
    categories: pickApifyInterestCategories(input.platformKey, head, owner, hashtags),
    recentPublications: recent,
    contactEmail:
      str(head.publicEmail) ??
      str(head.email) ??
      str(head.businessEmail) ??
      str(owner.email) ??
      extractEmailFromText(bio),
    contactPhone:
      str(head.publicPhoneNumber) ??
      str(head.contactPhoneNumber) ??
      str(head.phoneNumber) ??
      null,
    contactLinks: normalizeContactLinks(
      [
        str(head.externalUrl),
        str(head.website),
        str(head.bioLink),
        str(head.bio_link),
        str(owner.bioLink),
        str(owner.link),
        str(owner.externalUrl),
      ].filter((value): value is string => Boolean(value))
    ),
    apifyRunId: input.apifyRunId,
  };
}

export type ApifyRawFetchSuccess = {
  profileRows: Record<string, unknown>[];
  postRows: Record<string, unknown>[];
  apifyRunId: string | null;
  detailsRunId: string | null;
  postsRunId: string | null;
  durationMs: number;
};

export type ApifyRawFetchResult =
  | ({ ok: true } & ApifyRawFetchSuccess)
  | { ok: false; reason: string; available: boolean; durationMs: number; apifyRunId?: string | null };

/**
 * Fetch raw Apify actor output without normalization.
 * Used by IPL to persist immutable raw snapshots before any merge/preview.
 */
export async function fetchApifyProfileRaw(input: {
  platform: string;
  username: string | null;
  profileUrl: string;
  timeoutMs?: number;
}): Promise<ApifyRawFetchResult> {
  const started = Date.now();

  if (!isCreatorEnrichmentWorkerEnabled()) {
    return {
      ok: false,
      available: false,
      reason: "Creator enrichment is disabled.",
      durationMs: Date.now() - started,
    };
  }

  const env = getMetricsCollectorEnv();
  const platformKey = canonicalPlatformKey(input.platform);
  const handle = normalizeHandle(input.username, input.profileUrl);

  if (!env.apifyToken) {
    return {
      ok: false,
      available: false,
      reason: "APIFY_TOKEN not configured.",
      durationMs: Date.now() - started,
    };
  }

  const actorId = apifyProfileActorIdForPlatform(platformKey, env);
  if (!actorId) {
    return {
      ok: false,
      available: false,
      reason: "Apify actor id not configured.",
      durationMs: Date.now() - started,
    };
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
      return {
        ok: false,
        available: true,
        reason: detailsRun.error,
        durationMs: Date.now() - started,
        apifyRunId: detailsRun.runId,
      };
    }

    let postRows: Record<string, unknown>[] = [];
    let apifyRunId = detailsRun.runId;
    let postsRunId: string | null = null;

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
        postsRunId = postsRun.runId;
      }
    }

    logApifyEnrichment("Raw fetch complete", {
      platform: platformKey,
      username: handle,
      profileRows: detailsRun.rows.length,
      postRows: postRows.length,
      apifyRunId,
    });

    return {
      ok: true,
      profileRows: detailsRun.rows,
      postRows,
      apifyRunId,
      detailsRunId: detailsRun.runId,
      postsRunId,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Apify request failed.";
    return {
      ok: false,
      available: true,
      reason,
      durationMs: Date.now() - started,
    };
  }
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
  if (!isCreatorEnrichmentWorkerEnabled()) {
    logApifyEnrichment("Skipped Apify", {
      fallbackReason: "Creator enrichment globally disabled.",
      platform: input.platform,
      username: input.username,
    });
    return {
      ok: false,
      available: false,
      reason: "Creator enrichment is disabled.",
    };
  }

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

  const actorId = apifyProfileActorIdForPlatform(platformKey, env);
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

  const raw = await fetchApifyProfileRaw(input);
  if (!raw.ok) {
    if (raw.available) {
      logApifyEnrichment("Apify profile fetch failed", {
        platform: platformKey,
        fallbackReason: raw.reason,
        apifyRunId: raw.apifyRunId ?? null,
      });
    }
    return { ok: false, available: raw.available, reason: raw.reason };
  }

  const data = normalizeApifyProfileData({
    platformKey,
    username: input.username,
    profileUrl: input.profileUrl,
    profileRows: raw.profileRows,
    postRows: raw.postRows,
    apifyRunId: raw.apifyRunId,
  });

  if (!data) {
    logApifyEnrichment("Apify normalization empty", {
      platform: platformKey,
      fallbackReason: "Apify returned no usable items.",
      apifyRunId: raw.apifyRunId,
    });
    return { ok: false, available: true, reason: "Apify returned no usable items." };
  }

  logApifyEnrichment("Normalization output", {
    platform: platformKey,
    apifyRunId: data.apifyRunId,
    followers: data.followers,
    engagementRate: data.engagementRate,
    profilePictureUrl: data.profilePictureUrl,
    recentPublications: data.recentPublications.length,
    displayName: data.displayName,
    samplePublication: data.recentPublications[0] ?? null,
  });

  return { ok: true, data };
}
