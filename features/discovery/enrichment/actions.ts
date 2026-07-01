"use server";

import { requirePermission } from "@/lib/auth/permissions";
import { CREATOR_ENRICHMENT_PERMISSION } from "@/lib/creator-enrichment/constants";
import type { EnrichmentScope } from "@/lib/creator-enrichment/enabled";
import { getCreatorEnrichmentQueueHealth } from "@/lib/creator-enrichment/health";
import { getUnifiedCreatorById } from "@/lib/creators/unified-browse";
import {
  getCreatorMetricsSyncStatus,
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
};

export type StopEnrichmentActionResult = {
  ok: boolean;
  stopped: boolean;
  message: string;
  stoppedCount?: number;
};

async function refreshCreatorWithScope(
  influencerId: string,
  scope: EnrichmentScope,
  options?: { platformAccountId?: string; isBulk?: boolean }
): Promise<EnrichmentActionResult> {
  if (!influencerId?.trim()) {
    return { ok: false, queued: false, message: "A creator id is required." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, CREATOR_ENRICHMENT_PERMISSION);
  if ("error" in auth) {
    return { ok: false, queued: false, message: auth.error };
  }

  const refreshOptions = {
    force: true,
    trigger: "manual" as const,
    bypassMetricsManualOverride: scope === "metrics" || scope === "all",
    forceAvatarReplace: scope === "avatar" || scope === "all",
    forceInterestReplace: scope === "categories" || scope === "all",
    requestedBy: auth.userId,
    scope,
    isBulk: options?.isBulk ?? false,
    platformAccountId: options?.platformAccountId ?? null,
  };

  const result = options?.platformAccountId
    ? await refreshCreatorPlatformMetrics(
        supabase,
        influencerId.trim(),
        options.platformAccountId.trim(),
        refreshOptions
      )
    : await refreshCreatorMetrics(supabase, influencerId.trim(), refreshOptions);

  return {
    ok: result.ok,
    queued: result.queued,
    message: result.message,
  };
}

/** Explicit full refresh — all scopes. */
export async function refreshCreatorAllAction(
  influencerId: string
): Promise<EnrichmentActionResult> {
  return refreshCreatorWithScope(influencerId, "all");
}

/** Refresh followers, engagement, and views only. */
export async function refreshCreatorAction(
  influencerId: string
): Promise<EnrichmentActionResult> {
  return refreshCreatorWithScope(influencerId, "metrics");
}

export async function refreshCreatorAvatarAction(
  influencerId: string
): Promise<EnrichmentActionResult> {
  return refreshCreatorWithScope(influencerId, "avatar");
}

export async function refreshCreatorProfileAction(
  influencerId: string
): Promise<EnrichmentActionResult> {
  return refreshCreatorWithScope(influencerId, "profile");
}

export async function refreshCreatorAudienceAction(
  influencerId: string
): Promise<EnrichmentActionResult> {
  return refreshCreatorWithScope(influencerId, "audience");
}

export async function refreshCreatorCategoriesAction(
  influencerId: string
): Promise<EnrichmentActionResult> {
  return refreshCreatorWithScope(influencerId, "categories");
}

/** Refresh metrics for one platform account only (Discovery context menu). */
export async function refreshCreatorPlatformAction(
  influencerId: string,
  platformAccountId: string,
  scope: EnrichmentScope = "metrics"
): Promise<EnrichmentActionResult> {
  return refreshCreatorWithScope(influencerId, scope, { platformAccountId });
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

  const batch = await refreshCreatorMetricsBatchByUnifiedIds(supabase, unifiedIds, {
    force: true,
    trigger: "manual",
    bypassMetricsManualOverride: scope === "metrics" || scope === "all",
    forceAvatarReplace: scope === "avatar" || scope === "all",
    forceInterestReplace: scope === "categories" || scope === "all",
    requestedBy: auth.userId,
    scope,
    isBulk: true,
  });

  return {
    ok: batch.ok,
    queued: batch.queued > 0,
    queuedCount: batch.queued,
    message:
      batch.queued > 0
        ? `Queued ${batch.queued} of ${batch.total} creator refresh(es).`
        : batch.failed > 0
          ? `${batch.failed} refresh(es) could not be queued.`
          : "No creators queued.",
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
