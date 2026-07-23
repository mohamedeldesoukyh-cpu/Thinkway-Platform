/**
 * INTERNAL.
 * Do not call directly.
 * Use CreatorEnrichmentOrchestrator (via public APIs in `creator-enrichment-service.ts`) instead.
 *
 * Internal creator enrichment implementations — invoked by the orchestrator adapters only.
 * Public callers must use {@link refreshCreatorMetrics} and related exports from
 * `creator-enrichment-service.ts`, which route through {@link CreatorEnrichmentOrchestrator}.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { writeEnrichmentRun } from "@/lib/creator-enrichment/audit";
import {
  canEnqueueCreatorEnrichment,
  creatorEnrichmentDisabledMessage,
} from "@/lib/creator-enrichment/enabled";
import { decideEnrichment, priorityForTrigger } from "@/lib/creator-enrichment/policy";
import {
  creatorHasInflightEnrichmentJob,
  isCreatorEnrichmentQueueAvailable,
} from "@/lib/creator-enrichment/queue-operations";
import { enqueueCreatorEnrichmentImpl } from "@/lib/creator-enrichment/queue-impl";
import { resolveAggregatedCreatorEnrichmentStatus } from "@/lib/creator-enrichment/status-resolution";
import { runCreatorEnrichment } from "@/lib/creator-enrichment/service";
import {
  getBatchProfileAcquisitionConfig,
} from "@/lib/creator-enrichment/batch-profile-acquisition-policy";
import {
  getBatchProfileAcquisitionJob,
  startBatchProfileAcquisition,
} from "@/lib/creator-enrichment/batch-profile-acquisition-service";
import { runBatchProfileAcquisition } from "@/lib/creator-enrichment/batch-profile-acquisition-orchestrator";
import { isBatchProfileAcquisitionQueueAvailable } from "@/lib/creator-enrichment/batch-profile-acquisition-queue";
import type {
  CreatorEnrichmentJobPayload,
  CreatorEnrichmentResult,
  CreatorEnrichmentStatus,
  EnrichmentTrigger,
} from "@/lib/creator-enrichment/types";
import { promoteDiscoveredProfileToInfluencer } from "@/lib/discovery/promote-profile";
import type { Database } from "@/types/database";

import {
  getCreatorMetricsSyncStatus,
  mapEnrichmentStatusToSyncStatus,
  resolveCreatorInfluencerId,
  type RefreshCreatorMetricsBatchResult,
  type RefreshCreatorMetricsOptions,
  type RefreshCreatorMetricsResult,
} from "./creator-enrichment-service-shared";

type AnySupabase = SupabaseClient<Database>;

function buildJobPayload(
  influencerId: string,
  options: RefreshCreatorMetricsOptions
): CreatorEnrichmentJobPayload {
  const trigger = options.trigger ?? "manual";
  const dataSource = options.dataSource ?? "live_apify";
  const preferCached = dataSource === "cached_snapshot";
  return {
    influencerId,
    discoveredProfileId: options.discoveredProfileId ?? null,
    trigger,
    priority: priorityForTrigger(trigger),
    force: preferCached ? false : (options.force ?? false),
    bypassMetricsManualOverride: options.bypassMetricsManualOverride ?? false,
    forceAvatarReplace: options.forceAvatarReplace ?? false,
    forceInterestReplace: options.forceInterestReplace ?? false,
    requestedBy: options.requestedBy ?? null,
    platformAccountId: options.platformAccountId ?? null,
    scope: options.scope ?? (trigger === "manual" ? "metrics" : "all"),
    dataSource,
  };
}

function resultFromInline(
  influencerId: string,
  enrichment: CreatorEnrichmentResult,
  refreshSource: "cached_snapshot" | "live_apify"
): RefreshCreatorMetricsResult {
  const syncStatus =
    enrichment.status === "failed"
      ? "failed"
      : enrichment.status === "queued" || enrichment.status === "running"
        ? mapEnrichmentStatusToSyncStatus(enrichment.status)
        : "completed";

  return {
    ok: enrichment.ok,
    influencerId,
    syncStatus,
    queued: false,
    message: enrichment.message,
    enrichment,
    refreshSource,
  };
}

function shouldUseBatchProfileAcquisition(options: RefreshCreatorMetricsOptions): boolean {
  if (!getBatchProfileAcquisitionConfig().batchAcquisitionEnabled) return false;
  if (options.platformAccountId) return false;
  return true;
}

async function refreshCreatorMetricsViaBatchAcquisition(
  supabase: AnySupabase,
  unifiedIds: string[],
  options: RefreshCreatorMetricsOptions
): Promise<RefreshCreatorMetricsBatchResult> {
  const total = unifiedIds.length;
  console.log(`[refresh] batch size=${total} mode=batch_profile_acquisition`);

  const start = await startBatchProfileAcquisition(supabase, {
    unifiedIds,
    trigger: options.trigger ?? "manual",
    scope: options.scope,
    requestedBy: options.requestedBy,
    platformAccountId: options.platformAccountId,
  });

  if (!start.ok && !start.jobId) {
    return {
      ok: false,
      total,
      queued: 0,
      failed: total,
      results: [],
      message: start.message,
    };
  }

  if (!start.queued && start.jobId && !isBatchProfileAcquisitionQueueAvailable()) {
    const { resolveBatchProfileTargets } = await import(
      "@/lib/creator-enrichment/batch-profile-target-resolver"
    );
    const { targets } = await resolveBatchProfileTargets(supabase, {
      unifiedIds,
      platformAccountId: options.platformAccountId,
      requestedBy: options.requestedBy,
    });
    const inlineResult = await runBatchProfileAcquisition(supabase, {
      jobId: start.jobId,
      targets,
      trigger: options.trigger ?? "manual",
      scope: options.scope,
      requestedBy: options.requestedBy ?? null,
    });
    return {
      ok: inlineResult.ok,
      total,
      queued: inlineResult.creatorsImported + inlineResult.creatorsMerged,
      failed: inlineResult.creatorsFailed + start.targetsFailed,
      results: [],
      batchJobId: start.jobId,
      acquisitionMode: "batch_profile",
      estimatedApifyRuns: start.estimatedApifyRuns,
      estimatedCredits: inlineResult.estimatedCredits,
      batchCount: start.batchCount,
      message: inlineResult.reason,
    };
  }

  if (!start.queued) {
    return {
      ok: false,
      total,
      queued: 0,
      failed: total,
      results: [],
      batchJobId: start.jobId,
      message: start.message,
    };
  }

  const syntheticResults: RefreshCreatorMetricsResult[] = unifiedIds.map(() => ({
    ok: start.ok,
    influencerId: null,
    syncStatus: "queued",
    queued: true,
    message: start.message,
  }));

  return {
    ok: start.ok,
    total,
    queued: start.targetsResolved,
    failed: start.targetsFailed,
    results: syntheticResults,
    batchJobId: start.jobId,
    acquisitionMode: "batch_profile",
    estimatedApifyRuns: start.estimatedApifyRuns,
    estimatedCredits: start.estimatedCredits,
    batchCount: start.batchCount,
    message: start.message,
  };
}

async function refreshCreatorMetricsByUnifiedIdImpl(
  supabase: AnySupabase,
  unifiedId: string,
  options: RefreshCreatorMetricsOptions = {}
): Promise<RefreshCreatorMetricsResult> {
  const trimmed = unifiedId.trim();
  if (trimmed.startsWith("inf:")) {
    return refreshCreatorMetricsImpl(supabase, trimmed.slice(4), options);
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
    return refreshCreatorMetricsImpl(supabase, resolved.influencerId, {
      ...options,
      discoveredProfileId: profileId,
    });
  }
  return refreshCreatorMetricsImpl(supabase, trimmed, options);
}

/**
 * INTERNAL.
 * Do not call directly.
 * Use CreatorEnrichmentOrchestrator.requestRefresh() instead.
 */
export async function refreshCreatorMetricsImpl(
  supabase: AnySupabase,
  creatorId: string,
  options: RefreshCreatorMetricsOptions = {}
): Promise<RefreshCreatorMetricsResult> {
  console.log(`[refresh] requested creatorId=${creatorId.trim()}`);

  const resolved = await resolveCreatorInfluencerId(supabase, {
    influencerId: creatorId,
    discoveredProfileId: options.discoveredProfileId,
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

  const influencerId = resolved.influencerId;
  const payload = buildJobPayload(influencerId, options);
  const refreshSource = payload.dataSource ?? "live_apify";
  const forceRefresh = payload.force ?? false;
  const scope = payload.scope ?? "all";

  console.log(
    `[manual-refresh] requested creatorId=${influencerId.trim()} source=${refreshSource} scope=${scope}`
  );

  const gate = canEnqueueCreatorEnrichment(
    { trigger: payload.trigger, scope },
    { isBulk: options.isBulk ?? false }
  );
  if (!gate.allowed) {
    const message = gate.reason ?? creatorEnrichmentDisabledMessage();
    console.log(
      `[refresh] skipped creatorId=${influencerId.trim()} reason=${message}`
    );
    const syncStatus = await getCreatorMetricsSyncStatus(supabase, influencerId);
    const isManual = payload.trigger === "manual";
    return {
      ok: !isManual,
      influencerId,
      syncStatus,
      queued: false,
      message,
    };
  }

  if (!forceRefresh) {
    const [{ data: creatorRow, error: creatorError }, { data: platformRows }] =
      await Promise.all([
        supabase
          .from("influencers")
          .select("enrichment_status, last_enriched_at")
          .eq("id", influencerId)
          .maybeSingle(),
        supabase
          .from("influencer_platform_accounts")
          .select("enrichment_status")
          .eq("influencer_id", influencerId),
      ]);

    if (creatorError) {
      return {
        ok: false,
        influencerId,
        syncStatus: "failed",
        queued: false,
        message: creatorError.message,
      };
    }

    const skipDecision = decideEnrichment({
      lastEnrichedAt: (creatorRow as { last_enriched_at: string | null } | null)
        ?.last_enriched_at,
      force: false,
    });

    if (skipDecision.skip) {
      const resolvedStatus = resolveAggregatedCreatorEnrichmentStatus({
        creatorId: influencerId,
        storedStatus:
          (creatorRow as { enrichment_status: CreatorEnrichmentStatus } | null)
            ?.enrichment_status ?? "never",
        platformStatuses: (platformRows ?? []).map(
          (row) => (row as { enrichment_status: CreatorEnrichmentStatus }).enrichment_status
        ),
        hasInflightJob: false,
      });
      return {
        ok: true,
        influencerId,
        syncStatus: mapEnrichmentStatusToSyncStatus(resolvedStatus),
        queued: false,
        message: skipDecision.reason,
      };
    }
  }

  if (options.mode === "inline" || refreshSource === "cached_snapshot") {
    try {
      const enrichment = await runCreatorEnrichment(supabase, payload, {
        attempt: options.attempt ?? 1,
        jobId: options.jobId ?? null,
      });
      console.log(
        `[manual-refresh] completed creatorId=${influencerId.trim()} source=${refreshSource} status=${enrichment.status}`
      );
      return resultFromInline(influencerId, enrichment, refreshSource);
    } catch (error) {
      return {
        ok: false,
        influencerId,
        syncStatus: "failed",
        queued: false,
        message: error instanceof Error ? error.message : "Enrichment failed.",
        refreshSource,
      };
    }
  }

  if (!isCreatorEnrichmentQueueAvailable()) {
    return {
      ok: false,
      influencerId,
      syncStatus: "failed",
      queued: false,
      message: "Enrichment queue is not configured (REDIS_URL missing).",
    };
  }

  if (await creatorHasInflightEnrichmentJob(influencerId)) {
    const syncStatus = await getCreatorMetricsSyncStatus(supabase, influencerId);
    return {
      ok: true,
      influencerId,
      syncStatus,
      queued: false,
      message: "Enrichment already in progress.",
    };
  }

  // Internal adapter chain — enqueue stays inside the refresh impl (no nested orchestrator envelope).
  const enqueueResult = await enqueueCreatorEnrichmentImpl(payload, {
    isBulk: options.isBulk ?? false,
  });
  if (!enqueueResult.queued) {
    return {
      ok: false,
      influencerId,
      syncStatus: "failed",
      queued: false,
      message: enqueueResult.reason ?? "Could not queue enrichment.",
    };
  }

  console.log(
    `[refresh] queued creatorIds=${JSON.stringify([influencerId])} batch size=1 publication jobs queued=0`
  );

  const now = new Date().toISOString();
  await supabase
    .from("influencers")
    .update({ enrichment_status: "queued" } as never)
    .eq("id", influencerId);

  await writeEnrichmentRun(supabase, {
    influencerId,
    discoveredProfileId: payload.discoveredProfileId,
    trigger: payload.trigger,
    priority: payload.priority,
    status: "queued",
    forced: Boolean(payload.force),
    jobId: enqueueResult.jobId ?? null,
    requestedBy: payload.requestedBy,
    startedAt: now,
  });

  return {
    ok: true,
    influencerId,
    syncStatus: "queued",
    queued: true,
    message: "Refresh queued.",
    jobId: enqueueResult.jobId,
    refreshSource,
  };
}

/**
 * INTERNAL.
 * Do not call directly.
 * Use CreatorEnrichmentOrchestrator.requestBatchRefresh() instead.
 */
export async function refreshCreatorMetricsBatchByUnifiedIdsImpl(
  supabase: AnySupabase,
  unifiedIds: string[],
  options: RefreshCreatorMetricsOptions = {}
): Promise<RefreshCreatorMetricsBatchResult> {
  const uniqueUnifiedIds = [...new Set(unifiedIds.filter(Boolean))];

  if (options.isBulk && shouldUseBatchProfileAcquisition(options)) {
    return refreshCreatorMetricsViaBatchAcquisition(supabase, uniqueUnifiedIds, options);
  }

  console.log(`[refresh] batch size=${uniqueUnifiedIds.length} mode=per_creator`);
  const results: RefreshCreatorMetricsResult[] = [];

  for (const unifiedId of uniqueUnifiedIds) {
    results.push(await refreshCreatorMetricsByUnifiedIdImpl(supabase, unifiedId, options));
  }

  const queued = results.filter((r) => r.queued).length;
  const failed = results.filter((r) => !r.ok).length;
  const queuedIds = results
    .filter((r) => r.queued && r.influencerId)
    .map((r) => r.influencerId as string);

  if (queuedIds.length > 0) {
    console.log(
      `[refresh] queued creatorIds=${JSON.stringify(queuedIds)} batch size=${uniqueUnifiedIds.length} publication jobs queued=0`
    );
  }

  return {
    ok: failed === 0,
    total: uniqueUnifiedIds.length,
    queued,
    failed,
    results,
  };
}

/**
 * INTERNAL.
 * Do not call directly.
 * Use CreatorEnrichmentOrchestrator.executeJob() instead.
 */
export async function executeCreatorMetricsRefreshImpl(
  supabase: AnySupabase,
  payload: CreatorEnrichmentJobPayload,
  options?: { attempt?: number; jobId?: string | null }
): Promise<CreatorEnrichmentResult> {
  return runCreatorEnrichment(supabase, payload, options);
}

export { getBatchProfileAcquisitionJob };
