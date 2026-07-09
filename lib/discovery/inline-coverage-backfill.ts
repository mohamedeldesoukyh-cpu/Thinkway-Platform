import type { SupabaseClient } from "@supabase/supabase-js";

import { getMetricsCollectorEnv } from "@/lib/performance/metrics-collector/config";
import { apifyActorIdForPlatform } from "@/lib/performance/metrics-collector/providers/apify-input";
import { importApifyProfileWithDnaPipeline } from "@/lib/discovery/apify-import-pipeline";
import type { DiscoveryJobPayload, DiscoveryPlatform } from "@/lib/discovery/types";

export type InlineCoverageBackfillInput = {
  searchId: string;
  jobPayload: DiscoveryJobPayload;
  timeoutMs?: number;
  maxProfiles?: number;
};

export type InlineCoverageBackfillResult = {
  profilesAdded: number;
  reason: string;
  jobId?: string;
};

function inlineBackfillTimeoutMs(): number {
  const raw = process.env.DISCOVERY_INLINE_BACKFILL_TIMEOUT_MS?.trim();
  const parsed = raw ? Number(raw) : 30_000;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30_000;
}

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

function extractUsernamesFromApifyRows(rows: Record<string, unknown>[]): string[] {
  const handles = new Set<string>();
  for (const row of rows) {
    for (const key of ["ownerUsername", "username", "userName", "authorMeta.name"] as const) {
      const value =
        key.includes(".")
          ? null
          : typeof row[key] === "string"
            ? (row[key] as string)
            : null;
      if (value) handles.add(value.replace(/^@+/, "").toLowerCase());
    }
    const owner = row.ownerUsername ?? row.username;
    if (typeof owner === "string" && owner.trim()) {
      handles.add(owner.replace(/^@+/, "").toLowerCase());
    }
    const authorMeta = row.authorMeta;
    if (authorMeta && typeof authorMeta === "object" && !Array.isArray(authorMeta)) {
      const name = (authorMeta as { name?: unknown }).name;
      if (typeof name === "string" && name.trim()) {
        handles.add(name.replace(/^@+/, "").toLowerCase());
      }
    }
  }
  return [...handles];
}

async function discoverUsernamesViaApifyHashtag(
  platform: DiscoveryPlatform,
  hashtag: string,
  limit: number,
  timeoutMs: number
): Promise<{ usernames: string[]; reason: string }> {
  const env = getMetricsCollectorEnv();
  const token = env.apifyToken;
  const actorId = apifyActorIdForPlatform(platform, env);
  if (!token) {
    return { usernames: [], reason: "APIFY_TOKEN not configured for inline discovery backfill." };
  }
  if (!actorId) {
    return { usernames: [], reason: `No Apify actor configured for platform ${platform}.` };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = resolveHashtagUrl(platform, hashtag);
    const input =
      platform === "instagram"
        ? { directUrls: [url], resultsType: "posts", resultsLimit: Math.min(limit * 2, 50) }
        : platform === "tiktok"
          ? { hashtags: [hashtag.replace(/^#+/, "")], resultsPerPage: Math.min(limit * 2, 50) }
          : { directUrls: [url], resultsLimit: Math.min(limit * 2, 50) };

    const response = await fetch(
      `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?waitForFinish=120`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      return {
        usernames: [],
        reason: `Apify hashtag run failed (${response.status}).`,
      };
    }

    const payload = (await response.json()) as {
      data?: { defaultDatasetId?: string; status?: string };
    };
    const datasetId = payload.data?.defaultDatasetId;
    if (!datasetId) {
      return { usernames: [], reason: "Apify run returned no dataset." };
    }

    const itemsResponse = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?limit=${Math.min(limit * 2, 50)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }
    );
    if (!itemsResponse.ok) {
      return { usernames: [], reason: `Apify dataset fetch failed (${itemsResponse.status}).` };
    }

    const rows = (await itemsResponse.json()) as Record<string, unknown>[];
    const usernames = extractUsernamesFromApifyRows(rows).slice(0, limit);
    if (usernames.length === 0) {
      return {
        usernames: [],
        reason: `Apify hashtag #${hashtag} returned no usernames on ${platform}.`,
      };
    }
    return {
      usernames,
      reason: `Inline Apify hashtag #${hashtag} discovered ${usernames.length} username(s).`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inline Apify backfill failed";
    return { usernames: [], reason: message };
  } finally {
    clearTimeout(timer);
  }
}

function resolveInlineHashtag(payload: DiscoveryJobPayload): string {
  if (payload.method === "hashtag" && payload.hashtag?.trim()) {
    return payload.hashtag.trim().replace(/^#+/, "");
  }
  if (payload.method === "location") {
    return (
      payload.locationQuery?.trim().replace(/^#+/, "") ||
      payload.coverageIntent?.categories?.[0]?.trim().replace(/^#+/, "") ||
      "creator"
    );
  }
  return payload.coverageIntent?.categories?.[0]?.trim().replace(/^#+/, "") || "creator";
}

/**
 * Dev/local fallback when BullMQ worker is unavailable.
 * Uses Apify hashtag scrape + DNA import pipeline (bounded timeout).
 */
export async function runInlineCoverageBackfill(
  supabase: SupabaseClient,
  input: InlineCoverageBackfillInput
): Promise<InlineCoverageBackfillResult> {
  const timeoutMs = input.timeoutMs ?? inlineBackfillTimeoutMs();
  const maxProfiles = input.maxProfiles ?? 8;
  const platform = (input.jobPayload.platform ?? "instagram") as DiscoveryPlatform;
  const hashtag = resolveInlineHashtag(input.jobPayload);
  const countryCode = input.jobPayload.coverageIntent?.country ?? input.jobPayload.locationCountry;
  const categoryTags = input.jobPayload.coverageIntent?.categories ?? [];

  const { data: job, error: jobError } = await supabase
    .from("discovery_jobs")
    .insert({
      job_type: `discovery:inline_backfill:${input.jobPayload.method}`,
      method: input.jobPayload.method,
      status: "running",
      payload: {
        ...input.jobPayload,
        searchId: input.searchId,
        inline: true,
      },
      started_at: new Date().toISOString(),
      created_by: null,
    })
    .select("id")
    .single();

  const jobId = jobError ? undefined : (job.id as string);

  const discovery = await discoverUsernamesViaApifyHashtag(
    platform,
    hashtag,
    maxProfiles,
    timeoutMs
  );
  if (discovery.usernames.length === 0) {
    if (jobId) {
      await supabase
        .from("discovery_jobs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          profiles_discovered: 0,
          error_message: discovery.reason,
        })
        .eq("id", jobId);
    }
    return { profilesAdded: 0, reason: discovery.reason, jobId };
  }

  let profilesAdded = 0;
  for (const username of discovery.usernames) {
    const imported = await importApifyProfileWithDnaPipeline(supabase, {
      platform,
      username,
      countryCode,
      categoryTags,
      searchId: input.searchId,
    });
    if (imported.ok) profilesAdded += 1;
  }

  const reason =
    profilesAdded > 0
      ? `Inline backfill imported ${profilesAdded} profile(s) via Apify #${hashtag}.`
      : `Apify found ${discovery.usernames.length} username(s) but import pipeline added 0 profiles.`;

  if (jobId) {
    await supabase
      .from("discovery_jobs")
      .update({
        status: profilesAdded > 0 ? "completed" : "failed",
        completed_at: new Date().toISOString(),
        profiles_discovered: profilesAdded,
        error_message: profilesAdded > 0 ? null : reason,
        result: { inline: true, hashtag, profiles_added: profilesAdded },
      })
      .eq("id", jobId);
  }

  return { profilesAdded, reason, jobId };
}
