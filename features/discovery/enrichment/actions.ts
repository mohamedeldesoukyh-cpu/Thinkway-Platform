"use server";

import { requirePermission } from "@/lib/auth/permissions-server";
import { CREATOR_ENRICHMENT_PERMISSION } from "@/lib/creator-enrichment/constants";
import type { EnrichmentScope } from "@/lib/creator-enrichment/enabled";
import { getCreatorEnrichmentQueueHealth } from "@/lib/creator-enrichment/health";
import {
  assessManualRefreshCache,
  type ManualRefreshCacheAssessment,
} from "@/lib/creator-enrichment/manual-refresh-cache-assessment";
import type { ManualRefreshDataSource } from "@/lib/creator-enrichment/manual-refresh-policy";
import { logManualRefreshTrace } from "@/lib/creator-enrichment/manual-refresh-trace";
import { getUnifiedCreatorById } from "@/lib/creators/unified-browse";
import {
  getCreatorMetricsSyncStatus,
  getBatchProfileAcquisitionJob,
  refreshCreatorMetrics,
  refreshCreatorMetricsBatchByUnifiedIds,
  refreshCreatorPlatformMetrics,
  stopCreatorMetricsRefreshByUnifiedId,
  stopCreatorMetricsRefreshBatchByUnifiedIds,
} from "@/lib/services/creators/creator-enrichment-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type EnrichmentActionResult = {
  ok: boolean;
  queued: boolean;
  message: string;
  queuedCount?: number;
  batchJobId?: string | null;
  acquisitionMode?: "batch_profile" | "per_creator";
  estimatedApifyRuns?: number;
  estimatedCredits?: number;
  batchCount?: number;
  refreshSource?: ManualRefreshDataSource;
};

export type ManualRefreshCacheAssessmentResult =
  | { ok: true; assessment: ManualRefreshCacheAssessment }
  | { ok: false; message: string };

export type StopEnrichmentActionResult = {
  ok: boolean;
  stopped: boolean;
  message: string;
  stoppedCount?: number;
};

async function refreshCreatorWithScope(
  influencerId: string,
  scope: EnrichmentScope,
  options?: {
    platformAccountId?: string;
    isBulk?: boolean;
    dataSource?: ManualRefreshDataSource;
    feature?: import("@/lib/creator-enrichment/enrichment-feature").CreatorEnrichmentFeature;
  }
): Promise<EnrichmentActionResult> {
  if (!influencerId?.trim()) {
    return { ok: false, queued: false, message: "A creator id is required." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, CREATOR_ENRICHMENT_PERMISSION);
  if ("error" in auth) {
    return { ok: false, queued: false, message: auth.error };
  }

  const dataSource = options?.dataSource ?? "live_apify";
  const preferCached = dataSource === "cached_snapshot";
  // Manual Refresh (live Apify) may set force=true to bypass freshness.
  const refreshOptions = {
    force: !preferCached,
    trigger: "manual" as const,
    bypassMetricsManualOverride: scope === "metrics" || scope === "all",
    forceAvatarReplace: scope === "avatar" || scope === "all",
    forceInterestReplace: scope === "categories" || scope === "all",
    requestedBy: auth.userId,
    scope,
    isBulk: options?.isBulk ?? false,
    platformAccountId: options?.platformAccountId ?? null,
    dataSource,
    mode: preferCached ? ("inline" as const) : undefined,
    feature: options?.feature,
  };

  logManualRefreshTrace("action_enter", {
    influencerId: influencerId.trim(),
    scope,
    dataSource,
    force: refreshOptions.force,
    platformAccountId: options?.platformAccountId ?? null,
    feature: options?.feature ?? null,
  });

  const startedAt = Date.now();
  const result = options?.platformAccountId
    ? await refreshCreatorPlatformMetrics(
        supabase,
        influencerId.trim(),
        options.platformAccountId.trim(),
        refreshOptions
      )
    : await refreshCreatorMetrics(supabase, influencerId.trim(), refreshOptions);

  logManualRefreshTrace("action_exit", {
    influencerId: result.influencerId ?? influencerId.trim(),
    ok: result.ok,
    queued: result.queued,
    syncStatus: result.syncStatus,
    message: result.message,
    jobId: result.jobId ?? null,
    refreshSource: result.refreshSource ?? dataSource,
    durationMs: Date.now() - startedAt,
  });

  return {
    ok: result.ok,
    queued: result.queued,
    message: result.message,
    refreshSource: result.refreshSource ?? dataSource,
  };
}

export async function getManualRefreshCacheAssessmentAction(input: {
  influencerId: string;
  scope?: EnrichmentScope;
  platformAccountId?: string | null;
}): Promise<ManualRefreshCacheAssessmentResult> {
  if (!input.influencerId?.trim()) {
    return { ok: false, message: "A creator id is required." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, CREATOR_ENRICHMENT_PERMISSION);
  if ("error" in auth) {
    return { ok: false, message: auth.error };
  }

  const assessment = await assessManualRefreshCache(supabase, {
    influencerId: input.influencerId.trim(),
    platformAccountId: input.platformAccountId ?? null,
    scope: input.scope,
  });

  return { ok: true, assessment };
}

/** Explicit full refresh — all scopes. */
export async function refreshCreatorAllAction(
  influencerId: string,
  dataSource?: ManualRefreshDataSource
): Promise<EnrichmentActionResult> {
  return refreshCreatorWithScope(influencerId, "all", {
    dataSource,
    feature: "campaign_studio",
  });
}

/** Refresh followers, engagement, and views only. */
export async function refreshCreatorAction(
  influencerId: string,
  dataSource?: ManualRefreshDataSource
): Promise<EnrichmentActionResult> {
  return refreshCreatorWithScope(influencerId, "metrics", { dataSource });
}

export async function refreshCreatorAvatarAction(
  influencerId: string,
  dataSource?: ManualRefreshDataSource
): Promise<EnrichmentActionResult> {
  return refreshCreatorWithScope(influencerId, "avatar", { dataSource });
}

export async function refreshCreatorProfileAction(
  influencerId: string,
  dataSource?: ManualRefreshDataSource
): Promise<EnrichmentActionResult> {
  return refreshCreatorWithScope(influencerId, "profile", { dataSource });
}

export async function refreshCreatorAudienceAction(
  influencerId: string,
  dataSource?: ManualRefreshDataSource
): Promise<EnrichmentActionResult> {
  return refreshCreatorWithScope(influencerId, "audience", { dataSource });
}

export async function refreshCreatorCategoriesAction(
  influencerId: string,
  dataSource?: ManualRefreshDataSource
): Promise<EnrichmentActionResult> {
  return refreshCreatorWithScope(influencerId, "categories", { dataSource });
}

/** Refresh metrics for one platform account only (Discovery context menu). */
export async function refreshCreatorPlatformAction(
  influencerId: string,
  platformAccountId: string,
  scope: EnrichmentScope = "metrics",
  dataSource?: ManualRefreshDataSource
): Promise<EnrichmentActionResult> {
  return refreshCreatorWithScope(influencerId, scope, { platformAccountId, dataSource });
}

/** Batch refresh for selected creators in Discovery Search. */
export async function refreshCreatorsBatchAction(
  unifiedIds: string[],
  scope: EnrichmentScope = "metrics"
): Promise<EnrichmentActionResult> {
  if (unifiedIds.length === 0) {
    return { ok: false, queued: false, message: "Select at least one creator." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, CREATOR_ENRICHMENT_PERMISSION);
  if ("error" in auth) {
    return { ok: false, queued: false, message: auth.error };
  }

  logManualRefreshTrace("action_enter", {
    path: "refreshCreatorsBatchAction",
    count: unifiedIds.length,
    scope,
    force: false,
    isBulk: true,
  });

  // Batch refresh must not force — Decision Engine + freshness admit each creator.
  const startedAt = Date.now();
  const batch = await refreshCreatorMetricsBatchByUnifiedIds(supabase, unifiedIds, {
    force: false,
    trigger: "manual",
    bypassMetricsManualOverride: scope === "metrics" || scope === "all",
    forceAvatarReplace: scope === "avatar" || scope === "all",
    forceInterestReplace: scope === "categories" || scope === "all",
    requestedBy: auth.userId,
    scope,
    isBulk: true,
    feature: "batch_refresh",
  });

  logManualRefreshTrace("action_exit", {
    path: "refreshCreatorsBatchAction",
    ok: batch.ok,
    queued: batch.queued,
    failed: batch.failed,
    total: batch.total,
    acquisitionMode: batch.acquisitionMode ?? "per_creator",
    batchJobId: batch.batchJobId ?? null,
    durationMs: Date.now() - startedAt,
  });

  return {
    ok: batch.ok,
    queued: batch.queued > 0,
    queuedCount: batch.queued,
    batchJobId: batch.batchJobId ?? null,
    acquisitionMode: batch.acquisitionMode ?? "per_creator",
    estimatedApifyRuns: batch.estimatedApifyRuns,
    estimatedCredits: batch.estimatedCredits,
    batchCount: batch.batchCount,
    message:
      batch.message ??
      (batch.queued > 0
        ? `Queued ${batch.queued} of ${batch.total} creator refresh(es).`
        : batch.failed > 0
          ? `${batch.failed} refresh(es) could not be queued.`
          : "No creators queued."),
  };
}

/** Stop an in-flight metric refresh for one creator (Discovery row menu). */
export async function stopCreatorMetricsRefreshAction(
  unifiedId: string
): Promise<StopEnrichmentActionResult> {
  if (!unifiedId?.trim()) {
    return { ok: false, stopped: false, message: "A creator id is required." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, CREATOR_ENRICHMENT_PERMISSION);
  if ("error" in auth) {
    return { ok: false, stopped: false, message: auth.error };
  }

  const result = await stopCreatorMetricsRefreshByUnifiedId(supabase, unifiedId.trim());

  return {
    ok: result.ok,
    stopped: result.stopped,
    message: result.message,
  };
}

/** Stop in-flight metric refreshes for selected creators (Discovery bulk bar). */
export async function stopCreatorsMetricsRefreshBatchAction(
  unifiedIds: string[]
): Promise<StopEnrichmentActionResult> {
  if (unifiedIds.length === 0) {
    return { ok: false, stopped: false, message: "Select at least one creator." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, CREATOR_ENRICHMENT_PERMISSION);
  if ("error" in auth) {
    return { ok: false, stopped: false, message: auth.error };
  }

  const batch = await stopCreatorMetricsRefreshBatchByUnifiedIds(supabase, unifiedIds);

  return {
    ok: batch.ok,
    stopped: batch.stopped > 0,
    stoppedCount: batch.stopped,
    message:
      batch.stopped > 0
        ? `Stopped ${batch.stopped} refresh(es).`
        : batch.skipped > 0
          ? "No selected creators have a refresh in progress."
          : "No refreshes stopped.",
  };
}

/**
 * Detail-view auto enrichment removed — import and enrichment are separate.
 * Kept for API compatibility; always returns without queuing.
 */
export async function enqueueCreatorDetailEnrichment(
  _influencerId: string
): Promise<EnrichmentActionResult> {
  return { ok: true, queued: false, message: "Automatic detail enrichment is disabled." };
}

export async function getBatchProfileAcquisitionStatusAction(jobId: string) {
  if (!jobId?.trim()) {
    return { ok: false, message: "Job id is required.", progress: null };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, CREATOR_ENRICHMENT_PERMISSION);
  if ("error" in auth) {
    return { ok: false, message: auth.error, progress: null };
  }

  const job = await getBatchProfileAcquisitionJob(supabase, jobId.trim());
  if (!job) {
    return { ok: false, message: "Batch job not found.", progress: null };
  }

  return {
    ok: true,
    message: job.errorMessage ?? job.status,
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  };
}

export async function getCreatorEnrichmentStatusAction(influencerId: string) {
  if (!influencerId) return "pending" as const;

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, CREATOR_ENRICHMENT_PERMISSION);
  if ("error" in auth) return "pending" as const;

  return getCreatorMetricsSyncStatus(supabase, influencerId);
}

export async function getCreatorEnrichmentQueueHealthAction() {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, CREATOR_ENRICHMENT_PERMISSION);
  if ("error" in auth) {
    return {
      redisConfigured: false,
      queueReachable: false,
      waiting: 0,
      active: 0,
      delayed: 0,
      workerLikelyOffline: false,
      message: null,
    };
  }

  return getCreatorEnrichmentQueueHealth();
}

export async function getUnifiedCreatorAfterRefreshAction(unifiedId: string) {
  if (!unifiedId?.trim()) return null;

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, CREATOR_ENRICHMENT_PERMISSION);
  if ("error" in auth) return null;

  return getUnifiedCreatorById(supabase, unifiedId.trim());
}
