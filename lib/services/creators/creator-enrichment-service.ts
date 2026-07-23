/**
 * Unified creator metrics enrichment service (Apify).
 *
 * Single entry point for refreshing creator profile metrics regardless of how the
 * creator entered the platform: CSV import, discovery search, manual add, or
 * direct Apify search/import.
 *
 * All enrichment requests route through {@link CreatorEnrichmentOrchestrator} before
 * reaching the existing implementation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { getCreatorEnrichmentOrchestrator } from "@/lib/creator-enrichment/orchestrator";
import {
  getBatchProfileAcquisitionConfig,
} from "@/lib/creator-enrichment/batch-profile-acquisition-policy";
import {
  cancelCreatorEnrichmentJobs,
} from "@/lib/creator-enrichment/queue-operations";
import type {
  CreatorEnrichmentJobPayload,
  CreatorEnrichmentResult,
  CreatorEnrichmentStatus,
} from "@/lib/creator-enrichment/types";
export type { EnrichmentScope } from "@/lib/creator-enrichment/enabled";
import type { Database } from "@/types/database";

import { getBatchProfileAcquisitionJob } from "./creator-enrichment-service-impl";
import {
  getCreatorMetricsSyncStatus,
  mapEnrichmentStatusToSyncStatus,
  resolveCreatorInfluencerId,
  type CreatorMetricsSyncStatus,
  type RefreshCreatorMetricsBatchResult,
  type RefreshCreatorMetricsOptions,
  type RefreshCreatorMetricsResult,
  type StopCreatorMetricsRefreshBatchResult,
  type StopCreatorMetricsRefreshResult,
} from "./creator-enrichment-service-shared";

export type {
  CreatorMetricsSyncStatus,
  RefreshCreatorMetricsBatchResult,
  RefreshCreatorMetricsOptions,
  RefreshCreatorMetricsResult,
  StopCreatorMetricsRefreshBatchResult,
  StopCreatorMetricsRefreshResult,
} from "./creator-enrichment-service-shared";

export {
  getCreatorMetricsSyncStatus,
  mapEnrichmentStatusToSyncStatus,
  resolveCreatorInfluencerId,
};

type AnySupabase = SupabaseClient<Database>;

/**
 * Refresh metrics for a single creator via the unified Apify pipeline.
 *
 * @param creatorId — `influencers.id` (primary key used across the platform).
 */
export async function refreshCreatorMetrics(
  supabase: AnySupabase,
  creatorId: string,
  options: RefreshCreatorMetricsOptions = {}
): Promise<RefreshCreatorMetricsResult> {
  return getCreatorEnrichmentOrchestrator().requestRefresh(supabase, creatorId, options);
}

/** Batch refresh for demo flows (select subset → Refresh Metrics). */
export async function refreshCreatorMetricsBatch(
  supabase: AnySupabase,
  creatorIds: string[],
  options: RefreshCreatorMetricsOptions = {}
): Promise<RefreshCreatorMetricsBatchResult> {
  if (options.isBulk && shouldUseBatchProfileAcquisition(options)) {
    const unifiedIds = creatorIds.map((id) => `inf:${id}`);
    return refreshCreatorMetricsBatchByUnifiedIds(supabase, unifiedIds, options);
  }

  const uniqueIds = [...new Set(creatorIds.filter(Boolean))];
  console.log(`[refresh] batch size=${uniqueIds.length}`);
  const results: RefreshCreatorMetricsResult[] = [];

  for (const creatorId of uniqueIds) {
    results.push(await refreshCreatorMetrics(supabase, creatorId, options));
  }

  const queued = results.filter((r) => r.queued).length;
  const failed = results.filter((r) => !r.ok).length;
  const queuedIds = results
    .filter((r) => r.queued && r.influencerId)
    .map((r) => r.influencerId as string);

  if (queuedIds.length > 0) {
    console.log(
      `[refresh] queued creatorIds=${JSON.stringify(queuedIds)} batch size=${uniqueIds.length} publication jobs queued=0`
    );
  }

  return {
    ok: failed === 0,
    total: uniqueIds.length,
    queued,
    failed,
    results,
  };
}

/**
 * Refresh by unified browse identifiers (`inf:uuid` or `dis:uuid`).
 * Promotes discovery-only profiles when needed.
 */
export async function refreshCreatorMetricsByUnifiedId(
  supabase: AnySupabase,
  unifiedId: string,
  options: RefreshCreatorMetricsOptions = {}
): Promise<RefreshCreatorMetricsResult> {
  const trimmed = unifiedId.trim();
  if (trimmed.startsWith("inf:")) {
    return refreshCreatorMetrics(supabase, trimmed.slice(4), options);
  }
  if (trimmed.startsWith("dis:")) {
    const profileId = trimmed.slice(4);
    const resolved = await resolveCreatorInfluencerId(supabase, {
      discoveredProfileId: profileId,
      actorId: options.requestedBy,
    });
    if (!resolved.ok) {
      return {
        ok: false,
        influencerId: null,
        syncStatus: "failed",
        queued: false,
        message: resolved.message,
      };
    }
    return refreshCreatorMetrics(supabase, resolved.influencerId, {
      ...options,
      discoveredProfileId: profileId,
    });
  }
  return refreshCreatorMetrics(supabase, trimmed, options);
}

/** Refresh metrics for a single platform account on a creator. */
export async function refreshCreatorPlatformMetrics(
  supabase: AnySupabase,
  influencerId: string,
  platformAccountId: string,
  options: RefreshCreatorMetricsOptions = {}
): Promise<RefreshCreatorMetricsResult> {
  return refreshCreatorMetrics(supabase, influencerId, {
    ...options,
    platformAccountId,
  });
}

export async function refreshCreatorMetricsBatchByUnifiedIds(
  supabase: AnySupabase,
  unifiedIds: string[],
  options: RefreshCreatorMetricsOptions = {}
): Promise<RefreshCreatorMetricsBatchResult> {
  return getCreatorEnrichmentOrchestrator().requestBatchRefresh(
    supabase,
    unifiedIds,
    options
  );
}

function resolveStatusAfterRefreshCancel(
  lastEnrichedAt: string | null | undefined
): CreatorEnrichmentStatus {
  return lastEnrichedAt ? "enriched" : "never";
}

/**
 * Cancel queued/running metric refresh for one creator.
 * Removes BullMQ jobs and resets DB status when currently queued/running.
 */
export async function stopCreatorMetricsRefresh(
  supabase: AnySupabase,
  creatorId: string
): Promise<StopCreatorMetricsRefreshResult> {
  const resolved = await resolveCreatorInfluencerId(supabase, {
    influencerId: creatorId,
  });

  if (!resolved.ok) {
    return {
      ok: false,
      influencerId: null,
      stopped: false,
      jobsRemoved: 0,
      syncStatus: "pending",
      message: resolved.message,
    };
  }

  const influencerId = resolved.influencerId;
  const { data, error } = await supabase
    .from("influencers")
    .select("enrichment_status, last_enriched_at")
    .eq("id", influencerId)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      influencerId,
      stopped: false,
      jobsRemoved: 0,
      syncStatus: "pending",
      message: error?.message ?? "Creator not found.",
    };
  }

  const row = data as {
    enrichment_status: CreatorEnrichmentStatus;
    last_enriched_at: string | null;
  };

  if (row.enrichment_status !== "queued" && row.enrichment_status !== "running") {
    return {
      ok: true,
      influencerId,
      stopped: false,
      jobsRemoved: 0,
      syncStatus: mapEnrichmentStatusToSyncStatus(row.enrichment_status),
      message: "No refresh in progress.",
    };
  }

  const { removed } = await cancelCreatorEnrichmentJobs(influencerId);
  const nextStatus = resolveStatusAfterRefreshCancel(row.last_enriched_at);

  const { error: updateError } = await supabase
    .from("influencers")
    .update({ enrichment_status: nextStatus } as never)
    .eq("id", influencerId)
    .in("enrichment_status", ["queued", "running"]);

  if (updateError) {
    return {
      ok: false,
      influencerId,
      stopped: false,
      jobsRemoved: removed,
      syncStatus: mapEnrichmentStatusToSyncStatus(row.enrichment_status),
      message: updateError.message,
    };
  }

  return {
    ok: true,
    influencerId,
    stopped: true,
    jobsRemoved: removed,
    syncStatus: mapEnrichmentStatusToSyncStatus(nextStatus),
    message: removed > 0 ? "Refresh stopped." : "Refresh cancelled.",
  };
}

export async function stopCreatorMetricsRefreshByUnifiedId(
  supabase: AnySupabase,
  unifiedId: string
): Promise<StopCreatorMetricsRefreshResult> {
  const trimmed = unifiedId.trim();
  if (trimmed.startsWith("inf:")) {
    return stopCreatorMetricsRefresh(supabase, trimmed.slice(4));
  }
  if (trimmed.startsWith("dis:")) {
    const profileId = trimmed.slice(4);
    const resolved = await resolveCreatorInfluencerId(supabase, {
      discoveredProfileId: profileId,
    });
    if (!resolved.ok) {
      return {
        ok: false,
        influencerId: null,
        stopped: false,
        jobsRemoved: 0,
        syncStatus: "pending",
        message: resolved.message,
      };
    }
    return stopCreatorMetricsRefresh(supabase, resolved.influencerId);
  }
  return stopCreatorMetricsRefresh(supabase, trimmed);
}

export async function stopCreatorMetricsRefreshBatchByUnifiedIds(
  supabase: AnySupabase,
  unifiedIds: string[]
): Promise<StopCreatorMetricsRefreshBatchResult> {
  const uniqueIds = [...new Set(unifiedIds.filter(Boolean))];
  const results: StopCreatorMetricsRefreshResult[] = [];

  for (const unifiedId of uniqueIds) {
    results.push(await stopCreatorMetricsRefreshByUnifiedId(supabase, unifiedId));
  }

  const stopped = results.filter((r) => r.stopped).length;
  const skipped = results.filter((r) => r.ok && !r.stopped).length;

  return {
    ok: results.every((r) => r.ok),
    total: uniqueIds.length,
    stopped,
    skipped,
    results,
  };
}

/** Worker/import inline execution — routes through orchestrator to the merge engine. */
export async function executeCreatorMetricsRefresh(
  supabase: AnySupabase,
  payload: CreatorEnrichmentJobPayload,
  options?: { attempt?: number; jobId?: string | null }
): Promise<CreatorEnrichmentResult> {
  return getCreatorEnrichmentOrchestrator().executeJob(supabase, payload, options);
}

export { getBatchProfileAcquisitionJob };

function shouldUseBatchProfileAcquisition(options: RefreshCreatorMetricsOptions): boolean {
  if (!getBatchProfileAcquisitionConfig().batchAcquisitionEnabled) return false;
  if (options.platformAccountId) return false;
  return true;
}
