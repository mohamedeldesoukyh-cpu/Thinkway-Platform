"use server";

import { requirePermission } from "@/lib/auth/permissions";
import { CREATOR_ENRICHMENT_PERMISSION } from "@/lib/creator-enrichment/constants";
import { getCreatorEnrichmentQueueHealth } from "@/lib/creator-enrichment/health";
import { getUnifiedCreatorById } from "@/lib/creators/unified-browse";
import {
  getCreatorMetricsSyncStatus,
  refreshCreatorMetrics,
  refreshCreatorMetricsBatchByUnifiedIds,
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

/**
 * Explicit "Refresh Metrics" click. Forces a run, bypassing the 30-day skip.
 */
export async function refreshCreatorAction(
  influencerId: string
): Promise<EnrichmentActionResult> {
  if (!influencerId) {
    return { ok: false, queued: false, message: "A creator id is required." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, CREATOR_ENRICHMENT_PERMISSION);
  if ("error" in auth) {
    return { ok: false, queued: false, message: auth.error };
  }

  const result = await refreshCreatorMetrics(supabase, influencerId, {
    force: true,
    trigger: "manual",
    bypassMetricsManualOverride: true,
    requestedBy: auth.userId,
  });

  return {
    ok: result.ok,
    queued: result.queued,
    message: result.message,
  };
}

/** Batch refresh for selected creators in Discovery Search / Import Center demos. */
export async function refreshCreatorsBatchAction(
  unifiedIds: string[]
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
    bypassMetricsManualOverride: true,
    requestedBy: auth.userId,
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
 * Detail-view trigger (priority 3). Best-effort, respects the 30-day skip.
 * Safe to call on every sheet open — de-duped by job id and skipped when fresh.
 */
export async function enqueueCreatorDetailEnrichment(
  influencerId: string
): Promise<EnrichmentActionResult> {
  if (!influencerId) {
    return { ok: true, queued: false, message: "No enrichment queued." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, CREATOR_ENRICHMENT_PERMISSION);
  if ("error" in auth) {
    return { ok: true, queued: false, message: "No enrichment queued." };
  }

  const result = await refreshCreatorMetrics(supabase, influencerId, {
    force: false,
    trigger: "detail",
    requestedBy: auth.userId,
  });

  return {
    ok: true,
    queued: result.queued,
    message: result.queued ? "Enrichment queued." : "No enrichment queued.",
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
