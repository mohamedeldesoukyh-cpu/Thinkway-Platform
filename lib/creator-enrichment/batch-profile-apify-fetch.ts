/**
 * Launch Apify actor runs with many profile URLs in a single run (per platform).
 */

import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { shouldIncludeApifyProfilePosts } from "@/lib/creator-enrichment/apify-fetch-policy";
import type { EnrichmentScope } from "@/lib/creator-enrichment/enabled";
import { getMetricsCollectorEnv } from "@/lib/performance/metrics-collector/config";
import { apifyProfileActorIdForPlatform } from "@/lib/performance/metrics-collector/providers/apify-input";
import { assertApifyAcquisitionBudget } from "@/lib/discovery/control-center/apify-budget";
import {
  apifyRunGateKey,
  beginApifyRunGate,
} from "@/lib/performance/apify-run-gate";
import type { SocialPlatform } from "@/lib/social/platforms";

async function resolveBudgetSupabase() {
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    return createSupabaseAdminClient();
  } catch {
    return null;
  }
}

export type BatchApifyFetchResult = {
  ok: boolean;
  apifyRunId: string | null;
  datasetId: string | null;
  rows: Record<string, unknown>[];
  reason: string;
};

function normalizeHandle(value: string): string {
  return value.replace(/^@+/, "").trim().toLowerCase();
}

function buildBatchProfileDetailsInput(
  platform: SocialPlatform,
  profileUrls: string[],
  usernames: string[]
): Record<string, unknown> {
  const limit = profileUrls.length;
  switch (platform) {
    case "instagram":
      return { directUrls: profileUrls, resultsType: "details", resultsLimit: limit };
    case "tiktok": {
      const handles = usernames.map(normalizeHandle).filter(Boolean);
      return {
        profiles: handles,
        resultsPerPage: 6,
        shouldDownloadVideos: false,
      };
    }
    case "youtube":
      return {
        startUrls: profileUrls.map((url) => ({ url })),
        maxResults: 6,
      };
    case "facebook":
      return {
        startUrls: profileUrls.map((url) => ({ url })),
      };
    case "snapchat": {
      const handles = usernames.map(normalizeHandle).filter(Boolean);
      const entries = profileUrls.map((url, index) => handles[index] || url);
      return { usernames: entries };
    }
    default:
      return { directUrls: profileUrls, resultsLimit: limit };
  }
}

function buildBatchProfilePostsInput(
  platform: SocialPlatform,
  profileUrls: string[]
): Record<string, unknown> | null {
  if (platform !== "instagram") return null;
  return {
    directUrls: profileUrls,
    resultsType: "posts",
    resultsLimit: 6,
  };
}

async function fetchDatasetItems(
  datasetId: string,
  token: string
): Promise<Record<string, unknown>[]> {
  const response = await fetch(
    `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?format=json&limit=1000`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) {
    throw new Error(`Apify dataset fetch failed (${response.status}): ${await response.text()}`);
  }
  const items = (await response.json()) as unknown;
  if (!Array.isArray(items)) return [];
  return items.filter(
    (row): row is Record<string, unknown> =>
      Boolean(row) && typeof row === "object" && !Array.isArray(row)
  );
}

export async function runBatchApifyActor(input: {
  platform: SocialPlatform;
  profileUrls: string[];
  usernames: string[];
  label: string;
  timeoutMs: number;
  actorBody: Record<string, unknown>;
}): Promise<BatchApifyFetchResult> {
  const env = getMetricsCollectorEnv();
  const token = env.apifyToken;
  const platformKey = canonicalPlatformKey(input.platform) ?? input.platform;
  const actorId = apifyProfileActorIdForPlatform(platformKey, env);

  if (!token) {
    return {
      ok: false,
      apifyRunId: null,
      datasetId: null,
      rows: [],
      reason: "APIFY_TOKEN not configured.",
    };
  }
  if (!actorId) {
    console.warn(
      `[batch-profile-apify] skipped platform=${platformKey} reason=no actor configured`
    );
    return {
      ok: false,
      apifyRunId: null,
      datasetId: null,
      rows: [],
      reason: `No Apify actor configured for platform ${platformKey}.`,
    };
  }

  const budgetClient = await resolveBudgetSupabase();
  const budget = await assertApifyAcquisitionBudget(budgetClient, {
    source: "batch_profile_apify_fetch",
    meta: {
      platform: platformKey,
      label: input.label,
      profileCount: input.profileUrls.length,
    },
  });
  if (!budget.allowed) {
    return {
      ok: false,
      apifyRunId: null,
      datasetId: null,
      rows: [],
      reason: budget.reason,
    };
  }

  const gateKey = apifyRunGateKey({
    actorId,
    platform: platformKey,
    identities: [...input.usernames, ...input.profileUrls],
    label: input.label,
  });
  const gate = beginApifyRunGate(gateKey);
  if (!gate.allowed) {
    console.warn(`[batch-profile-apify] ${gate.reason} key=${gate.key}`);
    return {
      ok: false,
      apifyRunId: null,
      datasetId: null,
      rows: [],
      reason: gate.reason,
    };
  }

  const waitSeconds = Math.max(1, Math.ceil(input.timeoutMs / 1000));
  const response = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?waitForFinish=${waitSeconds}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input.actorBody),
      signal: AbortSignal.timeout(input.timeoutMs + 10_000),
    }
  );

  if (!response.ok) {
    return {
      ok: false,
      apifyRunId: null,
      datasetId: null,
      rows: [],
      reason: `Apify ${input.label} run failed (${response.status}).`,
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
      reason: `Apify ${input.label} run returned no dataset.`,
    };
  }

  const rows = await fetchDatasetItems(datasetId, token);
  return {
    ok: true,
    apifyRunId,
    datasetId,
    rows,
    reason: `Apify ${input.label} returned ${rows.length} row(s).`,
  };
}

export async function fetchBatchProfileRowsFromApify(input: {
  platform: SocialPlatform;
  profileUrls: string[];
  usernames: string[];
  timeoutMs: number;
  scope?: EnrichmentScope;
}): Promise<{
  ok: boolean;
  profileRows: Record<string, unknown>[];
  postRows: Record<string, unknown>[];
  apifyRunIds: string[];
  reason: string;
}> {
  const detailsInput = buildBatchProfileDetailsInput(
    input.platform,
    input.profileUrls,
    input.usernames
  );

  const detailsRun = await runBatchApifyActor({
    platform: input.platform,
    profileUrls: input.profileUrls,
    usernames: input.usernames,
    label: "batch-profile-details",
    timeoutMs: input.timeoutMs,
    actorBody: detailsInput,
  });

  if (!detailsRun.ok) {
    return {
      ok: false,
      profileRows: [],
      postRows: [],
      apifyRunIds: detailsRun.apifyRunId ? [detailsRun.apifyRunId] : [],
      reason: detailsRun.reason,
    };
  }

  const apifyRunIds = detailsRun.apifyRunId ? [detailsRun.apifyRunId] : [];
  let postRows: Record<string, unknown>[] = [];

  const postsInput = shouldIncludeApifyProfilePosts(input.scope)
    ? buildBatchProfilePostsInput(input.platform, input.profileUrls)
    : null;
  if (postsInput) {
    const postsRun = await runBatchApifyActor({
      platform: input.platform,
      profileUrls: input.profileUrls,
      usernames: input.usernames,
      label: "batch-profile-posts",
      timeoutMs: input.timeoutMs,
      actorBody: postsInput,
    });
    if (postsRun.ok) {
      postRows = postsRun.rows;
      if (postsRun.apifyRunId) apifyRunIds.push(postsRun.apifyRunId);
    }
  }

  return {
    ok: true,
    profileRows: detailsRun.rows,
    postRows,
    apifyRunIds,
    reason: `Batch profile fetch returned ${detailsRun.rows.length} detail row(s) and ${postRows.length} post row(s).`,
  };
}

/** Failures that will not succeed on retry — do not burn Apify credits. */
function isPermanentBatchApifyFailure(reason: string): boolean {
  return /not configured|no apify actor|APIFY_TOKEN|unsupported platform|invalid input|fail-closed|daily budget|daily Apify|budget usage could not be verified/i.test(
    reason
  );
}

export async function fetchBatchProfileRowsWithRetry(input: {
  platform: SocialPlatform;
  profileUrls: string[];
  usernames: string[];
  timeoutMs: number;
  maxRetries: number;
  retryBackoffMs: number;
  scope?: EnrichmentScope;
}): Promise<{
  ok: boolean;
  profileRows: Record<string, unknown>[];
  postRows: Record<string, unknown>[];
  apifyRunIds: string[];
  reason: string;
  attempts: number;
}> {
  let lastReason = "Batch profile fetch failed.";
  for (let attempt = 1; attempt <= input.maxRetries; attempt++) {
    try {
      const result = await fetchBatchProfileRowsFromApify({
        platform: input.platform,
        profileUrls: input.profileUrls,
        usernames: input.usernames,
        timeoutMs: input.timeoutMs,
        scope: input.scope,
      });
      if (result.ok) {
        return { ...result, attempts: attempt };
      }
      lastReason = result.reason;
      if (isPermanentBatchApifyFailure(lastReason)) {
        return { ...result, attempts: attempt };
      }
    } catch (error) {
      lastReason = error instanceof Error ? error.message : "Batch profile fetch threw.";
      if (isPermanentBatchApifyFailure(lastReason)) {
        break;
      }
    }

    if (attempt < input.maxRetries) {
      const delay = input.retryBackoffMs * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return {
    ok: false,
    profileRows: [],
    postRows: [],
    apifyRunIds: [],
    reason: lastReason,
    attempts: input.maxRetries,
  };
}
