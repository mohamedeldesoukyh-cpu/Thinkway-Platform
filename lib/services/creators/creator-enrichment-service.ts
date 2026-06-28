/**
 * Unified creator metrics enrichment service (Apify).
 *
 * Single entry point for refreshing creator profile metrics regardless of how the
 * creator entered the platform: CSV import, discovery search, manual add, or
 * direct Apify search/import.
 *
 * Queue mode (default) enqueues a BullMQ job processed by the discovery worker.
 * Inline mode runs {@link runCreatorEnrichment} synchronously (worker/import use).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { writeEnrichmentRun } from "@/lib/creator-enrichment/audit";
import { priorityForTrigger } from "@/lib/creator-enrichment/policy";
import {
  enqueueCreatorEnrichment,
  isCreatorEnrichmentQueueAvailable,
} from "@/lib/creator-enrichment/queue";
import { runCreatorEnrichment } from "@/lib/creator-enrichment/service";
import type {
  CreatorEnrichmentJobPayload,
  CreatorEnrichmentResult,
  CreatorEnrichmentStatus,
  EnrichmentTrigger,
} from "@/lib/creator-enrichment/types";
import { promoteDiscoveredProfileToInfluencer } from "@/lib/discovery/promote-profile";
import type { Database } from "@/types/database";

type AnySupabase = SupabaseClient<Database>;

/** Public sync status surfaced to UI and API consumers. */
export type CreatorMetricsSyncStatus =
  | "pending"
  | "queued"
  | "collecting"
  | "completed"
  | "failed";

export type RefreshCreatorMetricsOptions = {
  /** Bypass the 30-day freshness skip. Default true for explicit Refresh Metrics. */
  force?: boolean;
  trigger?: EnrichmentTrigger;
  requestedBy?: string | null;
  discoveredProfileId?: string | null;
  /** Queue (default) or run inline inside a worker. */
  mode?: "queue" | "inline";
  attempt?: number;
  jobId?: string | null;
};

export type RefreshCreatorMetricsResult = {
  ok: boolean;
  influencerId: string | null;
  syncStatus: CreatorMetricsSyncStatus;
  queued: boolean;
  message: string;
  jobId?: string;
  enrichment?: CreatorEnrichmentResult;
};

export type RefreshCreatorMetricsBatchResult = {
  ok: boolean;
  total: number;
  queued: number;
  failed: number;
  results: RefreshCreatorMetricsResult[];
};

/** Map DB enrichment_status to the public sync status enum. */
export function mapEnrichmentStatusToSyncStatus(
  status: CreatorEnrichmentStatus | null | undefined
): CreatorMetricsSyncStatus {
  switch (status) {
    case "queued":
      return "queued";
    case "running":
      return "collecting";
    case "enriched":
    case "partial":
    case "skipped":
      return "completed";
    case "failed":
      return "failed";
    case "never":
    default:
      return "pending";
  }
}

/** Resolve an influencer id from either a direct id or a discovered profile. */
export async function resolveCreatorInfluencerId(
  supabase: AnySupabase,
  input: {
    influencerId?: string | null;
    discoveredProfileId?: string | null;
    actorId?: string | null;
  }
): Promise<{ ok: true; influencerId: string } | { ok: false; message: string }> {
  const profileId = input.discoveredProfileId?.trim();

  if (input.influencerId?.trim()) {
    const candidate = input.influencerId.trim();
    const { data: influencer, error } = await supabase
      .from("influencers")
      .select("id")
      .eq("id", candidate)
      .maybeSingle();

    if (error) return { ok: false, message: error.message };
    if (influencer) return { ok: true, influencerId: candidate };

    // Not an influencer row — treat as discovered profile id when no explicit profile id.
    if (!profileId) {
      return resolveCreatorInfluencerId(supabase, {
        discoveredProfileId: candidate,
        actorId: input.actorId,
      });
    }
  }

  if (!profileId) {
    return { ok: false, message: "A creator or discovered profile id is required." };
  }

  const { data: profile, error } = await supabase
    .from("discovered_profiles")
    .select("id, influencer_id")
    .eq("id", profileId)
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!profile) return { ok: false, message: "Discovered profile not found." };

  if (profile.influencer_id) {
    return { ok: true, influencerId: profile.influencer_id };
  }

  if (!input.actorId) {
    return {
      ok: false,
      message: "Discovery profile must be promoted before metrics refresh.",
    };
  }

  const promoted = await promoteDiscoveredProfileToInfluencer(
    supabase,
    profileId,
    input.actorId
  );
  if (!promoted.ok) {
    return { ok: false, message: promoted.message };
  }
  return { ok: true, influencerId: promoted.influencerId };
}

export async function getCreatorMetricsSyncStatus(
  supabase: AnySupabase,
  influencerId: string
): Promise<CreatorMetricsSyncStatus> {
  const { data, error } = await supabase
    .from("influencers")
    .select("enrichment_status")
    .eq("id", influencerId)
    .maybeSingle();

  if (error || !data) return "pending";
  return mapEnrichmentStatusToSyncStatus(
    (data as { enrichment_status: CreatorEnrichmentStatus }).enrichment_status
  );
}

function buildJobPayload(
  influencerId: string,
  options: RefreshCreatorMetricsOptions
): CreatorEnrichmentJobPayload {
  const trigger = options.trigger ?? "manual";
  return {
    influencerId,
    discoveredProfileId: options.discoveredProfileId ?? null,
    trigger,
    priority: priorityForTrigger(trigger),
    force: options.force ?? true,
    requestedBy: options.requestedBy ?? null,
  };
}

function resultFromInline(
  influencerId: string,
  enrichment: CreatorEnrichmentResult
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
  };
}

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

  if (options.mode === "inline") {
    try {
      const enrichment = await runCreatorEnrichment(supabase, payload, {
        attempt: options.attempt ?? 1,
        jobId: options.jobId ?? null,
      });
      return resultFromInline(influencerId, enrichment);
    } catch (error) {
      return {
        ok: false,
        influencerId,
        syncStatus: "failed",
        queued: false,
        message: error instanceof Error ? error.message : "Enrichment failed.",
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

  const enqueueResult = await enqueueCreatorEnrichment(payload);
  if (!enqueueResult.queued) {
    return {
      ok: false,
      influencerId,
      syncStatus: "failed",
      queued: false,
      message: enqueueResult.reason ?? "Could not queue enrichment.",
    };
  }

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
  };
}

/** Batch refresh for demo flows (select subset → Refresh Metrics). */
export async function refreshCreatorMetricsBatch(
  supabase: AnySupabase,
  creatorIds: string[],
  options: RefreshCreatorMetricsOptions = {}
): Promise<RefreshCreatorMetricsBatchResult> {
  const uniqueIds = [...new Set(creatorIds.filter(Boolean))];
  const results: RefreshCreatorMetricsResult[] = [];

  for (const creatorId of uniqueIds) {
    results.push(await refreshCreatorMetrics(supabase, creatorId, options));
  }

  const queued = results.filter((r) => r.queued).length;
  const failed = results.filter((r) => !r.ok).length;

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

export async function refreshCreatorMetricsBatchByUnifiedIds(
  supabase: AnySupabase,
  unifiedIds: string[],
  options: RefreshCreatorMetricsOptions = {}
): Promise<RefreshCreatorMetricsBatchResult> {
  const results: RefreshCreatorMetricsResult[] = [];

  for (const unifiedId of unifiedIds) {
    results.push(await refreshCreatorMetricsByUnifiedId(supabase, unifiedId, options));
  }

  const queued = results.filter((r) => r.queued).length;
  const failed = results.filter((r) => !r.ok).length;

  return {
    ok: failed === 0,
    total: unifiedIds.length,
    queued,
    failed,
    results,
  };
}

/** Worker/import inline execution — delegates to the shared merge engine. */
export async function executeCreatorMetricsRefresh(
  supabase: AnySupabase,
  payload: CreatorEnrichmentJobPayload,
  options?: { attempt?: number; jobId?: string | null }
): Promise<CreatorEnrichmentResult> {
  return runCreatorEnrichment(supabase, payload, options);
}
