/**
 * Apify discovery search — one actor run, full dataset retained.
 */

import { getMetricsCollectorEnv } from "@/lib/performance/metrics-collector/config";
import { apifyActorIdForPlatform } from "@/lib/performance/metrics-collector/providers/apify-input";
import type { DiscoveryJobPayload, DiscoveryPlatform } from "@/lib/discovery/types";
import type { IntelligenceSufficiencyEvaluation } from "@/lib/discovery/intelligence-sufficiency";

export type ApifyDatasetSearchInput = {
  platform: DiscoveryPlatform;
  jobPayload: DiscoveryJobPayload;
  limit: number;
  timeoutMs: number;
  acquisitionHints?: IntelligenceSufficiencyEvaluation["acquisitionHints"];
};

export type ApifyDatasetSearchResult = {
  ok: boolean;
  apifyRunId: string | null;
  datasetId: string | null;
  rows: Record<string, unknown>[];
  reason: string;
};

function resolveHashtagUrl(platform: DiscoveryPlatform, hashtag: string): string {
  const tag = encodeURIComponent(hashtag.replace(/^#+/, ""));
  switch (platform) {
    case "tiktok":
      return `https://www.tiktok.com/tag/${tag}`;
    case "youtube":
      return `https://www.youtube.com/hashtag/${tag}`;
    case "twitter":
      return `https://x.com/hashtag/${tag}`;
    case "instagram":
    default:
      return `https://www.instagram.com/explore/tags/${tag}/`;
  }
}

function resolveSearchHashtag(
  payload: DiscoveryJobPayload,
  hints?: IntelligenceSufficiencyEvaluation["acquisitionHints"]
): string {
  if (hints?.seedHashtag?.trim()) {
    return hints.seedHashtag.trim().replace(/^#+/, "").toLowerCase();
  }

  if (payload.method === "location") {
    const locationToken =
      payload.locationQuery?.trim().replace(/^#+/, "").toLowerCase() ||
      payload.hashtag?.trim().replace(/^#+/, "").toLowerCase();
    if (locationToken) return locationToken;
  }

  if (payload.method === "hashtag" && payload.hashtag?.trim()) {
    return payload.hashtag.trim().replace(/^#+/, "");
  }

  if (payload.method === "location" && hints?.seedLocationQuery?.trim()) {
    return hints.seedLocationQuery.trim().replace(/^#+/, "").toLowerCase();
  }

  if (hints?.seedAudience?.trim() && !hints.seedCountry?.trim()) {
    const token = hints.seedAudience
      .split(/\s+/)
      .map((w) => w.replace(/^#+/, "").toLowerCase())
      .find((w) => w.length > 2 && w !== "beauty");
    if (token) return token;
  }

  if (hints?.seedCategory?.trim() && !hints.seedCountry?.trim()) {
    return hints.seedCategory.trim().replace(/^#+/, "").toLowerCase();
  }

  return (
    payload.coverageIntent?.categories?.[0]?.trim().replace(/^#+/, "").toLowerCase() ||
    "creator"
  );
}

function resolveResultsLimit(
  limit: number,
  hints?: IntelligenceSufficiencyEvaluation["acquisitionHints"]
): number {
  const base = Math.min(limit * 2, 50);
  if (hints?.broadenCreatorDiscovery) {
    return Math.min(base + 20, 80);
  }
  return base;
}

export async function fetchApifyDatasetItems(
  datasetId: string,
  token: string,
  maxItems = 1000
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let offset = 0;
  const pageSize = Math.min(1000, maxItems);

  while (items.length < maxItems) {
    const url = new URL(`https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items`);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", String(pageSize));
    url.searchParams.set("offset", String(offset));

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Apify dataset fetch failed (${response.status}): ${await response.text()}`);
    }

    const batch = (await response.json()) as Record<string, unknown>[];
    if (!Array.isArray(batch) || batch.length === 0) break;

    items.push(...batch);
    if (batch.length < pageSize) break;
    offset += batch.length;
  }

  return items.slice(0, maxItems);
}

/** Launch one Apify actor run and return the full dataset (not usernames only). */
export async function runApifyDiscoveryDatasetSearch(
  input: ApifyDatasetSearchInput
): Promise<ApifyDatasetSearchResult> {
  const env = getMetricsCollectorEnv();
  const token = env.apifyToken;
  const actorId = apifyActorIdForPlatform(input.platform, env);

  if (!token) {
    return {
      ok: false,
      apifyRunId: null,
      datasetId: null,
      rows: [],
      reason: "APIFY_TOKEN not configured for dataset acquisition.",
    };
  }
  if (!actorId) {
    return {
      ok: false,
      apifyRunId: null,
      datasetId: null,
      rows: [],
      reason: `No Apify actor configured for platform ${input.platform}.`,
    };
  }

  const hashtag = resolveSearchHashtag(input.jobPayload, input.acquisitionHints);
  const resultsLimit = resolveResultsLimit(input.limit, input.acquisitionHints);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const url = resolveHashtagUrl(input.platform, hashtag);
    const actorInput =
      input.platform === "instagram"
        ? { directUrls: [url], resultsType: "posts", resultsLimit }
        : input.platform === "tiktok"
          ? { hashtags: [hashtag], resultsPerPage: resultsLimit }
          : { directUrls: [url], resultsLimit };

    const response = await fetch(
      `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?waitForFinish=120`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(actorInput),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      return {
        ok: false,
        apifyRunId: null,
        datasetId: null,
        rows: [],
        reason: `Apify search run failed (${response.status}).`,
      };
    }

    const payload = (await response.json()) as {
      data?: { id?: string; defaultDatasetId?: string; status?: string };
    };
    const apifyRunId = payload.data?.id ?? null;
    const datasetId = payload.data?.defaultDatasetId ?? null;

    if (!datasetId) {
      return {
        ok: false,
        apifyRunId,
        datasetId: null,
        rows: [],
        reason: "Apify search run returned no dataset.",
      };
    }

    const rows = await fetchApifyDatasetItems(datasetId, token, resultsLimit);
    if (rows.length === 0) {
      return {
        ok: false,
        apifyRunId,
        datasetId,
        rows: [],
        reason: `Apify search #${hashtag} returned an empty dataset on ${input.platform}.`,
      };
    }

    return {
      ok: true,
      apifyRunId,
      datasetId,
      rows,
      reason: `Apify dataset search #${hashtag} returned ${rows.length} row(s).`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Apify dataset search failed";
    return {
      ok: false,
      apifyRunId: null,
      datasetId: null,
      rows: [],
      reason: message,
    };
  } finally {
    clearTimeout(timer);
  }
}
